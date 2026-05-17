// utils/analyzeCpp.js
const Parser = require("node-tree-sitter");
const C = require("tree-sitter-c");
const CPP = require("tree-sitter-cpp");

async function analyzeCpp(code, ext = "cpp") {
  const parser = new Parser();
  parser.setLanguage(CPP);


  const tree = parser.parse(code);
  const root = tree.rootNode;
  const suggestions = [];

  function walk(node) {
    // 🧩 Function detection
    if (node.type === "function_definition") {
      const declarator = node.childForFieldName("declarator");
      const funcName = declarator ? declarator.text : "<anonymous>";

      suggestions.push({
        type: "structure",
        message: `Function detected: ${funcName}`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        severity: "info",
        replacement: null,
      });
    }

    // 🧩 Variable declarations missing initialization
    if (node.type === "declaration") {
      const declText = node.text;
      if (!declText.includes("=")) {
        suggestions.push({
          type: "style",
          message: `Variable declared without initialization: "${declText.split(";")[0].trim()}"`,
          line: node.startPosition.row + 1,
          severity: "low",
          replacement: {
            from: declText.trim(),
            to: declText.replace(";", " = 0;"), // auto-fix idea
          },
        });
      }
    }

    // 🧩 Detect long functions (>15 lines)
    if (node.type === "function_definition") {
      const length = node.endPosition.row - node.startPosition.row;
      if (length > 15) {
        suggestions.push({
          type: "maintainability",
          message: `Function is too long (${length} lines). Consider refactoring.`,
          line: node.startPosition.row + 1,
          severity: "medium",
          replacement: null,
        });
      }
    }

    // 🧩 Unused return type 'void'
    if (node.type === "primitive_type" && node.text === "void") {
      suggestions.push({
        type: "optimization",
        message: `Consider avoiding 'void' if returning a value improves flexibility.`,
        line: node.startPosition.row + 1,
        severity: "low",
        replacement: null,
      });
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      walk(node.namedChild(i));
    }
  }

  walk(root);

  // ✅ Return structured suggestions
  return suggestions;
}

module.exports = analyzeCpp;
