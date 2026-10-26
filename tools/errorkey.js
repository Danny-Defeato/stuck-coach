// Shared by /stuck and the build hook, so both make the same errorKey from the same output.

// First error line with the file path and line number removed, so the same
// mistake on a different line still counts as the same error.
function makeErrorKey(output) {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => /error:|Exception|Error\b/.test(l)) || lines[0] || 'unknown error';
  return first
    .replace(/^.*?\.java:\d+:\s*/, '')
    .replace(/\([\w$]+\.java:\d+\)/g, '')
    .replace(/^error:\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { makeErrorKey };
