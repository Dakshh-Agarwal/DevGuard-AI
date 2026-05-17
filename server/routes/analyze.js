// server/routes/analyze.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const multer = require("multer");
const execAsync = util.promisify(exec);
const { reviewWithGemini, reviewMultiFileProject } = require("../utils/geminiReview");  
const analyzeJavaScript = require("../utils/analyzeJS");
const analyzeJava = require("../utils/analyzeJava");
const analyzeCpp = require("../utils/analyzeCpp");

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Simple request queue to prevent server overload
let isProcessingMultiFile = false;
const multiFileQueue = [];

const processQueue = async () => {
  if (isProcessingMultiFile || multiFileQueue.length === 0) return;
  
  isProcessingMultiFile = true;
  const { req, res, handler } = multiFileQueue.shift();
  
  console.log(`🔄 Processing queued request (${multiFileQueue.length} remaining in queue)`);
  
  try {
    await handler(req, res);
  } catch (error) {
    console.error('❌ Queue processing error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Queue processing failed', details: error.message });
    }
  } finally {
    isProcessingMultiFile = false;
    // Process next item in queue
    setTimeout(processQueue, 100);
  }
};

// Temp folder for uploaded files
const TEMP_DIR = path.join(__dirname, "../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Multer setup
const upload = multer({ dest: TEMP_DIR });

// Helper: fetch past rejected suggestions
async function getRejectionComments(code, language) {
  try {
    const { data, error } = await supabase
      .from("feedback")
      .select("comment, suggestion")
      .eq("language", language)
      .eq("code", code)
      .eq("decision", "reject");

    if (error) return [];
    return data.filter(d => d.comment?.trim())
               .map(d => `• Previously, "${d.suggestion}" was rejected because: "${d.comment}"`);
  } catch (err) {
    console.error("Supabase fetch error:", err);
    return [];
  }
}

// Language detection helper
const detectLanguage = (filename) => {
  const ext = path.extname(filename).toLowerCase().slice(1);  // e.g., 'js', 'py'
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'javascript';
  if (ext === 'py') return 'python';
  if (ext === 'java') return 'java';
  if (['c', 'cpp', 'h'].includes(ext)) return ext === 'c' ? 'c' : 'cpp';
  return null;  // Unsupported
};

/* -----------------------------------------------------
   Helper: Find a best-matching line number for a snippet
   Returns 1-based line number or null if not found
   - uses exact substring match first
   - then tries first non-empty snippet line fuzzy match
------------------------------------------------------*/
function findLineForSnippet(code, snippet) {
  if (!code || !snippet) return null;
  const normalizedSnippet = String(snippet).trim();
  if (!normalizedSnippet) return null;

  // 1) Exact substring match (fast & reliable)
  const idx = code.indexOf(normalizedSnippet);
  if (idx !== -1) {
    const prefix = code.slice(0, idx);
    return prefix.split(/\r?\n/).length; // 1-based
  }

  // 2) Fallback: use first non-empty line of snippet and search by inclusion
  const lines = code.split(/\r?\n/);
  const snippetFirst = normalizedSnippet.split(/\r?\n/).find(l => l && l.trim());
  if (!snippetFirst) return null;
  const f = snippetFirst.trim().replace(/\s+/g, ' ');

  for (let i = 0; i < lines.length; i++) {
    const lineNormalized = lines[i].trim().replace(/\s+/g, ' ');
    if (lineNormalized.includes(f) || f.includes(lineNormalized)) {
      return i + 1;
    }
  }

  // 3) No match
  return null;
}

/* -----------------------------------------------
   Unified single-file analysis helper
----------------------------------------------- */
async function processSingleFileAnalysis(code, language, rejectionComments = []) {
  let staticSuggestions = [];
  let geminiResult = { rawReview: 'Gemini analysis unavailable', suggestions: [] };

  try {
    console.log(`=== STARTING ANALYSIS FOR ${language} ===`);

    // Static analysis branches
    if (language === "python") {
      const tempFile = path.join(TEMP_DIR, "temp.py");
      fs.writeFileSync(tempFile, code);

      const scriptPath = path.join(__dirname, "../python/analyze_python.py");

      try {
        // Use exec and always read stdout (pylint may exit non-zero for syntax errors)
        const { stdout, stderr } = await new Promise((resolve, reject) => {
          exec(`python "${scriptPath}" "${tempFile}"`, (error, stdout, stderr) => {
            if (stdout && stdout.trim().startsWith("[")) return resolve({ stdout, stderr });
            if (error) return reject(error);
            resolve({ stdout, stderr });
          });
        });

        console.log("Python STDOUT:", stdout);
        console.log("Python STDERR:", stderr);

        try {
          const cleanOutput = stdout.trim().split("\n").find(line => line.trim().startsWith("["));
          staticSuggestions = cleanOutput ? JSON.parse(cleanOutput) : [];
        } catch (e) {
          console.error("JSON parse failed for python static output:", e);
          staticSuggestions = [];
        }
      } catch (err) {
        console.warn("Python analysis failed (continuing):", err.message || err);
        staticSuggestions = [];
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }

    } else if (language === "javascript") {
      staticSuggestions = await analyzeJavaScript(code);

    } else if (language === "java") {
      staticSuggestions = await analyzeJava(code);

    } else if (language === "cpp" || language === "c") {
      const ext = language === "c" ? "c" : "cpp";
      staticSuggestions = await analyzeCpp(code, ext);

    } else {
      console.warn(`Unsupported language: ${language}`);
      staticSuggestions = [];
    }

    // ALWAYS call Gemini for review
    console.log(`=== CALLING GEMINI FOR ${language} ===`);
    geminiResult = await reviewWithGemini(code, language, rejectionComments);
    console.log(`=== GEMINI RESULT FOR ${language} ===`, { 
      rawReviewPreview: geminiResult.rawReview?.substring(0, 100) + '...',
      rawReviewLength: geminiResult.rawReview?.length || 0,
      suggestionsCount: geminiResult.suggestions?.length || 0
    });

    // -----------------------------
    // Normalize Gemini suggestion line numbers to actual file
    // -----------------------------
    if (Array.isArray(geminiResult.suggestions) && geminiResult.suggestions.length > 0) {
      const before = geminiResult.suggestions.map(s => ({ line: s.line, message: s.message }));
      geminiResult.suggestions = geminiResult.suggestions.map((s) => {
        try {
          const copy = { ...s };
          // If Gemini returned a replacement.from snippet, try to find its exact line in the original code
          if (copy.replacement && copy.replacement.from) {
            const foundLine = findLineForSnippet(code, copy.replacement.from);
            if (foundLine) {
              copy.line = foundLine;
            } else {
              // last resort: if Gemini returned a numeric line that seems zero-based, try +1
              if (typeof copy.line === 'number' && copy.line >= 0) {
                const maybe = copy.line + 1;
                if (maybe <= code.split(/\r?\n/).length) copy.line = maybe;
              }
            }
          } else if (typeof copy.line === 'number') {
            // if line is 0 or negative, adjust to 1-based (common off-by-one)
            if (copy.line === 0) copy.line = 1;
            if (copy.line < 0) copy.line = 1;
            // clamp to file length
            const total = code.split(/\r?\n/).length;
            if (copy.line > total) copy.line = total;
          }
          return copy;
        } catch (e) {
          console.warn("Normalization failure for suggestion:", e);
          return s;
        }
      });

      console.log("=== Gemini suggestions lines BEFORE normalization ===", before);
      console.log("=== Gemini suggestions lines AFTER normalization ===", geminiResult.suggestions.map(s => ({ line: s.line, message: s.message })));
    }

  } catch (err) {
    console.error(`Analysis failed for ${language}:`, err);
    geminiResult = { rawReview: `Error during analysis: ${err.message}`, suggestions: [] };
  }

  // Merge static suggestions with Gemini suggestions properly
  const allSuggestions = [...staticSuggestions, ...geminiResult.suggestions];

  console.log(`=== FINAL ANALYSIS STRUCTURE FOR ${language} ===`, {
    staticCount: staticSuggestions.length,
    geminiSuggestionsCount: geminiResult.suggestions.length,
    totalSuggestions: allSuggestions.length,
    geminiRawReviewLength: geminiResult.rawReview?.length || 0
  });

  return {
    suggestions: allSuggestions,           // All suggestions combined
    geminiReview: geminiResult             // Separate Gemini review structure
  };
}

// --------------------- SINGLE FILE ANALYSIS ---------------------
router.post("/", async (req, res) => {
  const { language, code } = req.body;
  if (!language || !code) return res.status(400).json({ error: "Missing code or language" });

  const rejectionComments = await getRejectionComments(code, language);

  try {
    const analysis = await processSingleFileAnalysis(code, language, rejectionComments);

    console.log(`=== SINGLE-FILE RESPONSE STRUCTURE FOR ${language} ===`, {
      hasGeminiReview: !!analysis.geminiReview,
      geminiRawReviewExists: !!analysis.geminiReview.rawReview && analysis.geminiReview.rawReview !== 'Gemini analysis unavailable',
      suggestionsCount: analysis.suggestions.length,
      geminiSuggestionsCount: analysis.geminiReview.suggestions.length,
      responseKeys: Object.keys(analysis)
    });

    // Send the exact structure that the frontend expects
    res.json(analysis);

  } catch (err) {
    console.error("Single-file analysis failed:", err);
    res.status(500).json({ 
      error: "Analysis failed", 
      suggestions: [], 
      geminiReview: { rawReview: err.message, suggestions: [] } 
    });
  }
});

// --------------------- MULTI-FILE ANALYSIS ---------------------
router.post("/multi", upload.array("files"), (req, res) => {
  console.log('=== MULTI-FILE REQUEST RECEIVED ===', { fileCount: req.files?.length });
  
  // Add to queue to prevent concurrent processing
  multiFileQueue.push({
    req,
    res, 
    handler: handleMultiFileAnalysis
  });
  
  processQueue();
});

async function handleMultiFileAnalysis(req, res) {
  
  if (!req.files || !req.files.length) {
    console.error('=== NO FILES IN REQUEST ===');
    return res.status(400).json({ error: "No files uploaded" });
  }

  console.log('=== FILES RECEIVED ===', req.files.map(f => ({
    originalname: f.originalname,
    size: f.size,
    mimetype: f.mimetype
  })));

  try {
    // Parse paths if provided
    let pathsJson = req.body?.paths;
    const parsedPaths = pathsJson ? JSON.parse(pathsJson) : null;

    // Prepare files for enhanced multi-file analysis
    const projectFiles = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`=== Processing file: ${file.originalname} ===`);
      
      const code = fs.readFileSync(file.path, "utf8");
      console.log(`=== File ${file.originalname} read, length: ${code.length} ===`);
      
      // Determine filename (from paths or originalname)
      let filename = file.originalname;
      if (parsedPaths && Array.isArray(parsedPaths) && parsedPaths[i]) {
        filename = parsedPaths[i];
        console.log(`=== Using client path: ${filename} for file ${file.originalname} ===`);
      }
      
      const detectedLang = detectLanguage(filename);
      
      if (!detectedLang) {
        console.warn(`Unsupported file type: ${filename}`);
        // Still include unsupported files for context but mark them
        projectFiles.push({
          filename,
          code,
          language: 'text',
          supported: false
        });
      } else {
        projectFiles.push({
          filename,
          code,
          language: detectedLang,
          supported: true
        });
      }
      
      // Clean up temporary file
      fs.unlinkSync(file.path);
    }

    console.log(`=== STARTING ENHANCED MULTI-FILE ANALYSIS ===`, {
      totalFiles: projectFiles.length,
      supportedFiles: projectFiles.filter(f => f.supported).length,
      languages: [...new Set(projectFiles.filter(f => f.supported).map(f => f.language))]
    });

    // Use enhanced multi-file analysis
    const results = await reviewMultiFileProject(projectFiles.filter(f => f.supported));
    
    // Add unsupported files to results
    for (const file of projectFiles.filter(f => !f.supported)) {
      results.push({
        file: file.filename,
        code: file.code,
        analysis: { 
          suggestions: [], 
          geminiReview: { rawReview: "Unsupported file type (only JS, Python, Java, C/C++ supported)", suggestions: [] },
          error: "Unsupported file type"
        }
      });
    }

    console.log(`=== SENDING MULTI-FILE RESPONSE ===`, { 
      resultCount: results.length,
      sampleStructure: results[0] ? Object.keys(results[0]) : 'No results'
    });
    
    res.json({ results });
    
  } catch (error) {
    console.error('=== MULTI-FILE ANALYSIS ERROR ===', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Multi-file analysis failed', details: error.message });
    }
  }
}

module.exports = router;