const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Analyze Java code using Checkstyle
async function analyzeJava(code, filePath) {
  // If filePath not provided, create a temp file
  if (!filePath) {
    filePath = path.join(__dirname, `../temp/Temp_${Date.now()}.java`);
    fs.writeFileSync(filePath, code);
  }

  return new Promise((resolve) => {
    exec(`java -jar tools/checkstyle.jar -c tools/google_checks.xml "${filePath}"`, (err, stdout) => {
      if (err) {
        console.error("Checkstyle Error:", err);
        return resolve([{ type: "error", issue: "Checkstyle failed to run." }]);
      }

      const suggestions = stdout
        .split("\n")
        .filter(line => line.includes(path.basename(filePath)))
        .map(line => ({ type: "warning", issue: line.trim() }));

      resolve(suggestions);
    });
  });
}

module.exports = analyzeJava;
