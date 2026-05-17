// client/src/utils/parseGeminiReview.js
export function parseGeminiReview(text) {
  if (typeof text !== 'string') return [];

  const lines = text.split('\n');
  const sections = [];

  let currentSection = null;
  let insideCodeBlock = false;
  let codeLang = '';
  let codeLines = [];

  for (let line of lines) {
    const headerMatch = /^\*?\s*\*\*(.+?):\*\*/.exec(line.trim());

    const codeStart = line.trim().startsWith('```');

    // Handle code block toggle
    if (codeStart) {
      if (!insideCodeBlock) {
        insideCodeBlock = true;
        codeLang = line.trim().slice(3); // e.g. cpp, python
        codeLines = [];
      } else {
        insideCodeBlock = false;
        // Save code block as a section
        sections.push({
          type: 'code',
          lang: codeLang || 'text',
          code: codeLines.join('\n'),
        });
        codeLines = [];
      }
      continue;
    }

    if (insideCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (headerMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        type: 'text',
        title: headerMatch[1].trim(),
        content: [],
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}
