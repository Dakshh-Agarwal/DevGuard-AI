const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { checkstyleDuration, staticAnalysisErrors } = require("./metrics");

// Analyze Java code using Checkstyle
async function analyzeJava(code, filePath) {
  // If filePath not provided, create a temp file
  if (!filePath) {
    filePath = path.join(__dirname, `../temp/Temp_${Date.now()}.java`);
    fs.writeFileSync(filePath, code);
  }

  const checkStart = process.hrtime.bigint();

  return new Promise((resolve) => {
    exec(`java -jar tools/checkstyle.jar -c tools/google_checks.xml "${filePath}"`, (err, stdout) => {
      const checkSec = Number(process.hrtime.bigint() - checkStart) / 1e9;
      checkstyleDuration.observe(checkSec);

      if (err) {
        staticAnalysisErrors.inc({ tool: 'checkstyle' });
        logger.error("Checkstyle execution failed", {
          error: err.message,
          duration_sec: checkSec.toFixed(3),
          context: 'analyze.checkstyle',
        });
        return resolve([{ type: "error", issue: "Checkstyle failed to run." }]);
      }

      const suggestions = stdout
        .split("\n")
        .filter(line => line.includes(path.basename(filePath)))
        .map(line => ({ type: "warning", issue: line.trim() }));

      logger.info("Checkstyle analysis completed", {
        duration_sec: checkSec.toFixed(3),
        suggestionsCount: suggestions.length,
        context: 'analyze.checkstyle',
      });

      resolve(suggestions);
    });
  });
}

module.exports = analyzeJava;
