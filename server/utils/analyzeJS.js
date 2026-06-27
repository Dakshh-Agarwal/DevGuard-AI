// utils/analyzeJS.js
const logger = require("./logger");

/**
 * Simple JS static analyzer
 * @param {string} code - JS code to analyze
 * @returns {Array} suggestions [{ line, message }]
 */
async function analyzeJavaScript(code) {
  const analysisStart = process.hrtime.bigint();
  const suggestions = [];
  const lines = code.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Example: warn about console.log
    if (trimmed.startsWith("console.log")) {
      suggestions.push({
        line: index + 1,
        message: "Avoid leaving console.log statements in production code",
        source: "static"
      });
    }

    // Example: warn about var usage
    if (/\bvar\b/.test(trimmed)) {
      suggestions.push({
        line: index + 1,
        message: "Use let or const instead of var",
        source: "static"
      });
    }

    // Example: empty catch blocks
    if (/catch\s*\(\w*\)\s*{\s*}/.test(trimmed)) {
      suggestions.push({
        line: index + 1,
        message: "Empty catch block; consider handling the error",
        source: "static"
      });
    }
  });

  const analysisSec = Number(process.hrtime.bigint() - analysisStart) / 1e9;

  logger.info("JavaScript static analysis completed", {
    duration_sec: analysisSec.toFixed(3),
    suggestionsCount: suggestions.length,
    linesAnalyzed: lines.length,
    context: 'analyze.javascript',
  });

  return suggestions;
}

module.exports = analyzeJavaScript;
