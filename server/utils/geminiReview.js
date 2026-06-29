const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const logger = require("./logger");
const {
  geminiCallsTotal,
  geminiDuration,
  geminiRetriesTotal,
  geminiJsonParseErrors,
} = require("./metrics");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🚨 Never hide critical suggestions
const CRITICAL_TYPES = ["syntax", "logical", "semantic"];

/* -----------------------------------------------
   Utility: Retry with exponential backoff
----------------------------------------------- */
async function withRetries(fn, retries = 3, delay = 2000, modelName = 'unknown', timeoutMs = 45000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      return await Promise.race([fn(), timeoutPromise]);
    } catch (err) {
      lastError = err;
      geminiRetriesTotal.inc({ model: modelName });
      logger.warn(`Gemini attempt ${i + 1} failed`, {
        attempt: i + 1,
        maxRetries: retries,
        model: modelName,
        error: err.message,
        context: 'gemini.retry',
      });
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
    logger.error("Gemini response extraction error", {
      error: e.message,
      context: 'gemini.extract',
    });
  }

  // Retry if response isn't valid JSON
  if (!raw.startsWith("{")) {
    logger.warn("Gemini returned non-JSON, retrying with strict prompt", {
      responsePreview: raw.substring(0, 100),
      context: 'gemini.json',
    });
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
    logger.error("Missing GEMINI_API_KEY in .env file", {
      context: 'gemini.config',
    });
    return fallbackResponse("Missing Gemini API key");
  }

  const models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-lite"];
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
    logger.info(`Using MULTI-FILE prompt for ${projectContext.currentFile}`, {
      language,
      currentFile: projectContext.currentFile,
      fileCount: projectContext.fileCount,
      context: 'gemini.prompt',
    });
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
    logger.info(`Using SINGLE-FILE prompt for ${language}`, {
      language,
      codeLength: code.length,
      context: 'gemini.prompt',
    });
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
      logger.info(`Trying Gemini model: ${modelName}`, {
        model: modelName,
        context: 'gemini.model',
      });

      const callStart = process.hrtime.bigint();
      const model = genAI.getGenerativeModel({ model: modelName });

      try {
        result = await withRetries(() => enforceJSON(model, prompt), 3, 2000, modelName);
        chosenModel = modelName;

        const callSec = Number(process.hrtime.bigint() - callStart) / 1e9;
        geminiDuration.observe({ model: modelName }, callSec);
        geminiCallsTotal.inc({ model: modelName, status: 'success' });

        logger.info(`Gemini succeeded with ${modelName}`, {
          model: modelName,
          duration_sec: callSec.toFixed(3),
          context: 'gemini.success',
        });
        break;
      } catch (err) {
        const callSec = Number(process.hrtime.bigint() - callStart) / 1e9;
        geminiDuration.observe({ model: modelName }, callSec);
        geminiCallsTotal.inc({ model: modelName, status: 'failure' });

        logger.warn(`Gemini model ${modelName} failed`, {
          model: modelName,
          error: err.message,
          duration_sec: callSec.toFixed(3),
          context: 'gemini.failure',
        });
      }
    }

    if (!result) {
      geminiCallsTotal.inc({ model: 'all', status: 'fallback' });
      throw new Error("All Gemini models failed");
    }

    const cleaned = result
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      geminiJsonParseErrors.inc();
      logger.error("Gemini JSON parse error", {
        error: e.message,
        responsePreview: cleaned.substring(0, 200),
        context: 'gemini.parse',
      });
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
        logger.debug(`Skipping rejected suggestion at line ${s.line}`, {
          line: s.line,
          type: s.type,
          context: 'gemini.filter',
        });
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

    logger.info(`${orderedSuggestions.length} total suggestions ready`, {
      totalSuggestions: orderedSuggestions.length,
      staticCount: staticSuggestions.length,
      geminiCount: filteredSuggestions.length,
      model: chosenModel,
      context: 'gemini.complete',
    });

    return {
      rawReview: parsed.review || "No detailed summary available.",
      suggestions: orderedSuggestions,
    };
  } catch (err) {
    logger.error("Gemini review failed", {
      error: err.message,
      stack: err.stack,
      language,
      context: 'gemini.error',
    });
    return fallbackResponse(`Error: ${err.message}`);
  }
}

/* -----------------------------------------------
   Fallback Response (when Gemini fails)
----------------------------------------------- */
function fallbackResponse(errorMsg) {
  logger.warn("Using fallback response", {
    reason: errorMsg,
    context: 'gemini.fallback',
  });
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
  logger.info(`Starting multi-file project analysis`, {
    fileCount: files.length,
    context: 'gemini.multiFile',
  });
  
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
    logger.info(`Analyzing file ${i + 1}/${files.length}: ${file.filename}`, {
      filename: file.filename,
      language: file.language,
      fileIndex: i + 1,
      totalFiles: files.length,
      context: 'gemini.multiFile',
    });
    
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

      logger.info(`Completed analysis for ${file.filename}`, {
        filename: file.filename,
        suggestionsCount: analysis.suggestions?.length || 0,
        hasGeminiReview: !!geminiResult.rawReview,
        context: 'gemini.multiFile',
      });
    } catch (error) {
      logger.error(`Failed to analyze ${file.filename}`, {
        filename: file.filename,
        error: error.message,
        context: 'gemini.multiFile',
      });
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
