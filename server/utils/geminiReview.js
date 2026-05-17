const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🚨 Never hide critical suggestions
const CRITICAL_TYPES = ["syntax", "logical", "semantic"];

/* -----------------------------------------------
   Utility: Retry with exponential backoff
----------------------------------------------- */
async function withRetries(fn, retries = 3, delay = 2000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Attempt ${i + 1} failed: ${err.message}`);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }
  throw lastError;
}

/* -----------------------------------------------
   Force Gemini to return JSON consistently
----------------------------------------------- */
async function enforceJSON(model, prompt) {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  let raw = "";
  try {
    if (typeof result.response.text === "function") {
      raw = result.response.text().trim();
    } else {
      raw =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        "";
    }
  } catch (e) {
    console.error("Extraction error:", e.message);
  }

  // Retry if response isn’t valid JSON
  if (!raw.startsWith("{")) {
    console.warn("⚠️ Gemini returned non-JSON, retrying...");
    const retryPrompt = `
STRICT MODE: Output ONLY valid JSON — no markdown, no commentary.

Schema:
{
  "review": "string summary",
  "suggestions": [
    { 
      "line": number, 
      "type": "logical|syntax|semantic|security|performance|best-practice|style", 
      "message": "string", 
      "replacement": { "from": "string", "to": "string" }
    }
  ]
}

Now convert this to valid JSON:
${raw}
`;
    return enforceJSON(model, retryPrompt);
  }

  return raw;
}

/* -----------------------------------------------
   Extract rejected lines from comments
----------------------------------------------- */
function extractRejectedLines(rejectedMessages) {
  const linePattern = /line\s*(\d+)/i;
  const rejectedLines = [];

  rejectedMessages.forEach((msg) => {
    const match = msg.match(linePattern);
    if (match) rejectedLines.push(Number(match[1]));
  });

  return [...new Set(rejectedLines)]; // unique
}

/* -----------------------------------------------
   MAIN Gemini Review Function (Enhanced)
----------------------------------------------- */
async function reviewWithGemini(
  code,
  language = "python",
  rejectedMessages = [],
  staticSuggestions = [],
  isMultiFile = false,
  projectContext = null
) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Missing GEMINI_API_KEY in .env file");
    return fallbackResponse("Missing Gemini API key");
  }

  const models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.0-pro"];
  const rejectedLines = extractRejectedLines(rejectedMessages);

  // Add rejection info to the prompt
  const rejectionNotes =
    rejectedMessages.length > 0
      ? `Dont repeat these rejected suggestions for non-critical issues:\n${rejectedMessages
          .map((r, i) => `${i + 1}. "${r}"`)
          .join("\n")}\n\nDont give style or best-practice suggestions on the lines: [${rejectedLines.join(
          ", "
        )}]\n\n`
      : "";

  // Create context-aware prompt
  let prompt;
  
  if (isMultiFile && projectContext) {
    console.log(`🔄 Using MULTI-FILE prompt for ${projectContext.currentFile} (${language})`);
    // Multi-file project analysis prompt
    prompt = `
${rejectionNotes}
You are analyzing a ${language} project with multiple files. Consider code patterns, architecture, and cross-file relationships.

PROJECT CONTEXT:
- Total files: ${projectContext.fileCount}
- File types: ${projectContext.languages.join(', ')}
- Current file: ${projectContext.currentFile}

OTHER FILES IN PROJECT:
${projectContext.otherFiles.map(f => `- ${f.name}: ${f.summary}`).join('\n')}

Focus on:
1. **Architecture patterns** and consistency across files
2. **Cross-file dependencies** and potential coupling issues  
3. **Security vulnerabilities** that span multiple files
4. **Performance bottlenecks** in the overall system
5. **Code duplication** and opportunities for refactoring
6. **Missing error handling** or validation patterns

Respond ONLY with valid JSON (no markdown, backticks, or text).

{
  "review": "project-level analysis focusing on architecture, patterns, and cross-file issues",
  "suggestions": [
    {
      "line": 10,
      "type": "architecture|security|performance|duplication|coupling|pattern|validation",
      "message": "clear explanation with project context",
      "replacement": { "from": "snippet", "to": "improved snippet" }
    }
  ]
}

CURRENT FILE (${projectContext.currentFile}):
\`\`\`${language}
${code.substring(0, 2000)}
\`\`\`
`;
  } else {
    console.log(`🔄 Using SINGLE-FILE prompt for ${language}`);
    // Single file analysis prompt  
    prompt = `
${rejectionNotes}
You are a code reviewer. Analyze this ${language} code.

Respond ONLY with valid JSON (no markdown, backticks, or text).

{
  "review": "summary of code quality",
  "suggestions": [
    {
      "line": 10,
      "type": "logical|syntax|semantic|security|performance|best-practice|style",
      "message": "clear explanation",
      "replacement": { "from": "snippet", "to": "snippet" }
    }
  ]
}

Code:
\`\`\`${language}
${code.substring(0, 2000)}
\`\`\`
`;
  }

  try {
    let result;
    let chosenModel = null;

    // Try multiple Gemini models
    for (const modelName of models) {
      console.log(`🔄 Trying Gemini model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      try {
        result = await withRetries(() => enforceJSON(model, prompt));
        chosenModel = modelName;
        break;
      } catch (err) {
        console.warn(`⚠️ ${modelName} failed: ${err.message}`);
      }
    }

    if (!result) throw new Error("All Gemini models failed");
    console.log(`✅ Gemini succeeded with ${chosenModel}`);

    const cleaned = result
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Gemini JSON parse error:", e.message);
      return fallbackResponse("AI returned unparsable response");
    }

    // Filter out rejected lines for non-critical issues
    const filteredSuggestions = (parsed.suggestions || []).filter((s) => {
      if (
        rejectedLines.includes(Number(s.line)) &&
        ["style", "best-practice", "maintainability"].includes(
          (s.type || "").toLowerCase()
        )
      ) {
        console.log(
          `🛑 Skipping suggestion at line ${s.line} (previously rejected non-critical)`
        );
        return false;
      }
      return true;
    });

    // Merge static and Gemini suggestions (keep order)
    const orderedSuggestions = [
      ...staticSuggestions.map((s) => ({ ...s, source: "static" })),
      ...filteredSuggestions.map((s) => ({
        line: s.line ?? null,
        type: s.type || "unspecified",
        message: s.message || "",
        replacement: s.replacement || null,
        source: "gemini",
      })),
    ];

    console.log(`✅ ${orderedSuggestions.length} total suggestions ready`);
    return {
      rawReview: parsed.review || "No detailed summary available.",
      suggestions: orderedSuggestions,
    };
  } catch (err) {
    console.error("💥 Gemini review failed:", err.message);
    return fallbackResponse(`Error: ${err.message}`);
  }
}

/* -----------------------------------------------
   Fallback Response (when Gemini fails)
----------------------------------------------- */
function fallbackResponse(errorMsg) {
  console.warn("⚠️ Using fallback response due to error:", errorMsg);
  return {
    rawReview: `AI Review unavailable (${errorMsg}).`,
    suggestions: [
      {
        line: "N/A",
        message: "Consider adding error handling and comments.",
        replacement: null,
        source: "fallback",
      },
      {
        line: "N/A",
        message: "Run a linter or formatter for consistent style.",
        replacement: null,
        source: "fallback",
      },
    ],
  };
}

/* -----------------------------------------------
   Multi-File Project Analysis
----------------------------------------------- */
async function reviewMultiFileProject(files) {
  console.log(`🔄 Starting multi-file project analysis for ${files.length} files`);
  
  // Build project context
  const languages = [...new Set(files.map(f => f.language))];
  const projectContext = {
    fileCount: files.length,
    languages,
    totalLines: files.reduce((sum, f) => sum + (f.code.split('\n').length || 0), 0)
  };

  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`🔍 Analyzing file ${i + 1}/${files.length}: ${file.filename}`);
    
    // Create enhanced context for this file
    const fileContext = {
      ...projectContext,
      currentFile: file.filename,
      otherFiles: files
        .filter(f => f.filename !== file.filename)
        .map(f => ({
          name: f.filename,
          summary: `${f.language} file (${f.code.split('\n').length} lines)`
        }))
        .slice(0, 5) // Limit to prevent token overflow
    };

    try {
      // Use enhanced multi-file prompt
      const geminiResult = await reviewWithGemini(
        file.code,
        file.language,
        [], // rejectedMessages
        [], // staticSuggestions  
        true, // isMultiFile
        fileContext // projectContext
      );

      // Convert to the expected structure (matching processSingleFileAnalysis)
      const analysis = {
        suggestions: geminiResult.suggestions || [], // All suggestions 
        geminiReview: geminiResult // Separate Gemini review structure
      };

      results.push({
        file: file.filename,
        code: file.code,
        analysis: analysis
      });

      console.log(`✅ Completed analysis for ${file.filename}: ${analysis.suggestions?.length || 0} suggestions`);
      console.log(`✅ Gemini review available: ${geminiResult.rawReview ? 'YES' : 'NO'}`);
    } catch (error) {
      console.error(`❌ Failed to analyze ${file.filename}:`, error.message);
      results.push({
        file: file.filename,
        code: file.code,
        analysis: { 
          suggestions: [], 
          geminiReview: { rawReview: `Analysis failed: ${error.message}`, suggestions: [] }
        }
      });
    }
  }

  return results;
}

module.exports = { reviewWithGemini, reviewMultiFileProject };
