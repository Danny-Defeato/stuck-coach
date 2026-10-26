// Policy modes: how many hint levels /stuck may give. Shared by stuck.js and stuck-mode.js.
const fs = require('fs');
const path = require('path');

const POLICY_FILE = path.join(process.cwd(), '.stuck-policy.json');

// cap = highest hint level allowed. locked has no hint levels, only the explanation.
const MODES = {
  practice: { cap: 3, about: 'hints up to level 3 (the fix)' },
  graded: { cap: 2, about: 'hints stop at level 2 (no fix)' },
  locked: { cap: 0, about: 'explanation only, no hints' },
};

// Missing file means practice. A file that is broken or names an unknown mode
// falls back to the safest mode (locked) and says so in `warning`.
function readPolicy() {
  let text;
  try {
    text = fs.readFileSync(POLICY_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { mode: 'practice' };
    return { mode: 'locked', warning: `Could not read .stuck-policy.json (${e.code || e.message}), so I am using locked mode.` };
  }
  let policy;
  try {
    policy = JSON.parse(text);
  } catch (e) {
    return { mode: 'locked', warning: '.stuck-policy.json is not valid JSON, so I am using locked mode.' };
  }
  const mode = policy && policy.mode;
  if (typeof mode !== 'string' || !Object.prototype.hasOwnProperty.call(MODES, mode)) {
    return { mode: 'locked', warning: `.stuck-policy.json has an unknown mode (${JSON.stringify(mode)}), so I am using locked mode. Use practice, graded or locked.` };
  }
  return { mode };
}

function writeMode(mode) {
  fs.writeFileSync(POLICY_FILE, JSON.stringify({ mode }) + '\n');
}

module.exports = { MODES, readPolicy, writeMode };
