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
const logger = require("../utils/logger");
const {
  reviewsSubmittedTotal,
  reviewsCompletedTotal,
  reviewDuration,
  reviewIssuesTotal,
  reviewQueueSize,
  pylintDuration,
  staticAnalysisErrors,
  supabaseQueryDuration,
  supabaseErrorsTotal,
} = require("../utils/metrics");

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Simple request queue to prevent server overload
let isProcessingMultiFile = false;
const multiFileQueue = [];

const processQueue = async () => {
  if (isProcessingMultiFile || multiFileQueue.length === 0) return;
  
  isProcessingMultiFile = true;
  const { req, res, handler } = multiFileQueue.shift();
  reviewQueueSize.set(multiFileQueue.length);
  
  logger.info('Processing queued multi-file request', {
    queueRemaining: multiFileQueue.length,
    context: 'analyze.queue',
  });
  
  try {
    await handler(req, res);
  } catch (error) {
    logger.error('Queue processing error', {
      error: error.message,
      stack: error.stack,
      context: 'analyze.queue',
    });
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
  const queryStart = process.hrtime.bigint();
  try {
    const { data, error } = await supabase
      .from("feedback")
      .select("comment, suggestion")
      .eq("language", language)
      .eq("code", code)
      .eq("decision", "reject");

    const durationSec = Number(process.hrtime.bigint() - queryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, durationSec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
      return [];
    }
    return data.filter(d => d.comment?.trim())
               .map(d => `• Previously, "${d.suggestion}" was rejected because: "${d.comment}"`);
  } catch (err) {
    const durationSec = Number(process.hrtime.bigint() - queryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, durationSec);
    supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
    logger.error("Supabase rejection fetch error", {
      error: err.message,
      language,
      context: 'analyze.rejections',
    });
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
    logger.info(`Starting analysis for ${language}`, {
      language,
      codeLength: code.length,
      context: 'analyze.single',
    });

    // Static analysis branches
    if (language === "python") {
      const tempFile = path.join(TEMP_DIR, "temp.py");
      fs.writeFileSync(tempFile, code);

      const scriptPath = path.join(__dirname, "../python/analyze_python.py");
      const pylintStart = process.hrtime.bigint();

      try {
        // Use exec and always read stdout (pylint may exit non-zero for syntax errors)
        const { stdout, stderr } = await new Promise((resolve, reject) => {
          exec(`python "${scriptPath}" "${tempFile}"`, (error, stdout, stderr) => {
            if (stdout && stdout.trim().startsWith("[")) return resolve({ stdout, stderr });
            if (error) return reject(error);
            resolve({ stdout, stderr });
          });
        });

        const pylintSec = Number(process.hrtime.bigint() - pylintStart) / 1e9;
        pylintDuration.observe(pylintSec);

        logger.info("Pylint analysis completed", {
          language,
          duration_sec: pylintSec.toFixed(3),
          stdout_length: stdout?.length || 0,
          context: 'analyze.pylint',
        });

        try {
          const cleanOutput = stdout.trim().split("\n").find(line => line.trim().startsWith("["));
          staticSuggestions = cleanOutput ? JSON.parse(cleanOutput) : [];
        } catch (e) {
          logger.error("Pylint JSON parse failed", {
            error: e.message,
            context: 'analyze.pylint',
          });
          staticSuggestions = [];
        }
      } catch (err) {
        const pylintSec = Number(process.hrtime.bigint() - pylintStart) / 1e9;
        pylintDuration.observe(pylintSec);
        staticAnalysisErrors.inc({ tool: 'pylint' });
        logger.warn("Python analysis failed (continuing)", {
          error: err.message || String(err),
          duration_sec: pylintSec.toFixed(3),
          context: 'analyze.pylint',
        });
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
      logger.warn(`Unsupported language: ${language}`, {
        language,
        context: 'analyze.single',
      });
      staticSuggestions = [];
    }

    // ALWAYS call Gemini for review
    logger.info(`Calling Gemini for ${language} review`, {
      language,
      codeLength: code.length,
      rejectionCount: rejectionComments.length,
      context: 'analyze.gemini',
    });
    geminiResult = await reviewWithGemini(code, language, rejectionComments);
    logger.info(`Gemini review completed for ${language}`, {
      language,
      rawReviewLength: geminiResult.rawReview?.length || 0,
      suggestionsCount: geminiResult.suggestions?.length || 0,
      context: 'analyze.gemini',
    });

    // Record issue count metrics
    reviewIssuesTotal.observe(
      { language, source: 'static' },
      staticSuggestions.length
    );
    reviewIssuesTotal.observe(
      { language, source: 'gemini' },
      geminiResult.suggestions?.length || 0
    );

    // -----------------------------
    // Normalize Gemini suggestion line numbers to actual file
    // -----------------------------
    if (Array.isArray(geminiResult.suggestions) && geminiResult.suggestions.length > 0) {
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
          logger.warn("Line normalization failure", {
            error: e.message,
            context: 'analyze.normalize',
          });
          return s;
        }
      });
    }

  } catch (err) {
    logger.error(`Analysis failed for ${language}`, {
      error: err.message,
      stack: err.stack,
      language,
      context: 'analyze.single',
    });
    geminiResult = { rawReview: `Error during analysis: ${err.message}`, suggestions: [] };
  }

  // Merge static suggestions with Gemini suggestions properly
  const allSuggestions = [...staticSuggestions, ...geminiResult.suggestions];

  logger.info(`Analysis complete for ${language}`, {
    language,
    staticCount: staticSuggestions.length,
    geminiCount: geminiResult.suggestions.length,
    totalSuggestions: allSuggestions.length,
    context: 'analyze.single',
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

  const reviewStart = process.hrtime.bigint();
  reviewsSubmittedTotal.inc({ type: 'single' });

  logger.info('Single-file review submitted', {
    language,
    codeLength: code.length,
    context: 'analyze.single',
  });

  const rejectionComments = await getRejectionComments(code, language);

  try {
    const analysis = await processSingleFileAnalysis(code, language, rejectionComments);

    const durationSec = Number(process.hrtime.bigint() - reviewStart) / 1e9;
    reviewDuration.observe({ type: 'single', language }, durationSec);
    reviewsCompletedTotal.inc({ type: 'single', status: 'success' });

    logger.info('Single-file review completed', {
      language,
      suggestionsCount: analysis.suggestions.length,
      duration_sec: durationSec.toFixed(3),
      context: 'analyze.single',
    });

    // Send the exact structure that the frontend expects
    res.json(analysis);

  } catch (err) {
    const durationSec = Number(process.hrtime.bigint() - reviewStart) / 1e9;
    reviewDuration.observe({ type: 'single', language }, durationSec);
    reviewsCompletedTotal.inc({ type: 'single', status: 'failure' });

    logger.error("Single-file analysis failed", {
      error: err.message,
      stack: err.stack,
      language,
      duration_sec: durationSec.toFixed(3),
      context: 'analyze.single',
    });
    res.status(500).json({ 
      error: "Analysis failed", 
      suggestions: [], 
      geminiReview: { rawReview: err.message, suggestions: [] } 
    });
  }
});

// --------------------- MULTI-FILE ANALYSIS ---------------------
router.post("/multi", upload.array("files"), (req, res) => {
  reviewsSubmittedTotal.inc({ type: 'multi' });
  
  logger.info('Multi-file review request received', {
    fileCount: req.files?.length,
    context: 'analyze.multi',
  });
  
  // Add to queue to prevent concurrent processing
  multiFileQueue.push({
    req,
    res, 
    handler: handleMultiFileAnalysis
  });
  reviewQueueSize.set(multiFileQueue.length);
  
  processQueue();
});

async function handleMultiFileAnalysis(req, res) {
  const reviewStart = process.hrtime.bigint();
  
  if (!req.files || !req.files.length) {
    logger.warn('Multi-file request received with no files', {
      context: 'analyze.multi',
    });
    return res.status(400).json({ error: "No files uploaded" });
  }

  logger.info('Processing multi-file analysis', {
    fileCount: req.files.length,
    files: req.files.map(f => ({ name: f.originalname, size: f.size })),
    context: 'analyze.multi',
  });

  try {
    // Parse paths if provided
    let pathsJson = req.body?.paths;
    const parsedPaths = pathsJson ? JSON.parse(pathsJson) : null;

    // Prepare files for enhanced multi-file analysis
    const projectFiles = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const code = fs.readFileSync(file.path, "utf8");
      
      // Determine filename (from paths or originalname)
      let filename = file.originalname;
      if (parsedPaths && Array.isArray(parsedPaths) && parsedPaths[i]) {
        filename = parsedPaths[i];
      }
      
      const detectedLang = detectLanguage(filename);
      
      if (!detectedLang) {
        logger.warn(`Unsupported file type: ${filename}`, {
          filename,
          context: 'analyze.multi',
        });
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

    logger.info('Starting enhanced multi-file analysis', {
      totalFiles: projectFiles.length,
      supportedFiles: projectFiles.filter(f => f.supported).length,
      languages: [...new Set(projectFiles.filter(f => f.supported).map(f => f.language))],
      context: 'analyze.multi',
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

    const durationSec = Number(process.hrtime.bigint() - reviewStart) / 1e9;
    reviewDuration.observe({ type: 'multi', language: 'mixed' }, durationSec);
    reviewsCompletedTotal.inc({ type: 'multi', status: 'success' });

    logger.info('Multi-file analysis completed', {
      resultCount: results.length,
      duration_sec: durationSec.toFixed(3),
      context: 'analyze.multi',
    });
    
    res.json({ results });
    
  } catch (error) {
    const durationSec = Number(process.hrtime.bigint() - reviewStart) / 1e9;
    reviewDuration.observe({ type: 'multi', language: 'mixed' }, durationSec);
    reviewsCompletedTotal.inc({ type: 'multi', status: 'failure' });

    logger.error('Multi-file analysis error', {
      error: error.message,
      stack: error.stack,
      duration_sec: durationSec.toFixed(3),
      context: 'analyze.multi',
    });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Multi-file analysis failed', details: error.message });
    }
  }
}

module.exports = router;