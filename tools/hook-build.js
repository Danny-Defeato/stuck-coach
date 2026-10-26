// Claude Code hook: after my build command runs through Claude Code, count repeated
// failures and offer /stuck once. Plain code only: no model call, never runs the build.
// Fails open: any problem means exit 0 with no output, so it can never break a session.
const fs = require('fs');
const path = require('path');
const { makeErrorKey } = require('./errorkey');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const FAILS_FILE = path.join(ROOT, '.stuck-fails.json');
const CONFIG_FILE = path.join(ROOT, '.stuck-config.json');
const OFFER_AT = 3;
const OFFER = 'Build failed 3 times in a row. Type /stuck for a hint.';

// Claude Code writes one JSON object to stdin. Give up quietly if none arrives.
function readStdin() {
  return new Promise((resolve) => {
    let text = '';
    const timer = setTimeout(() => resolve(''), 2000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { text += d; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(text); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(''); });
  });
}

function readFails() {
  try {
    const saved = JSON.parse(fs.readFileSync(FAILS_FILE, 'utf8'));
    if (typeof saved.errorKey === 'string' && Number.isInteger(saved.count)) {
      return { errorKey: saved.errorKey, count: saved.count, offered: saved.offered === true };
    }
  } catch (e) {
    // missing or broken file: start over
  }
  return { errorKey: '', count: 0, offered: false };
}

function saveFails(state) {
  fs.writeFileSync(FAILS_FILE, JSON.stringify(state) + '\n');
}

async function main() {
  const event = JSON.parse(await readStdin());
  if (!event || typeof event !== 'object') return;
  if (event.tool_name !== 'Bash' && event.tool_name !== 'PowerShell') return;
  const ran = event.tool_input && event.tool_input.command;
  if (typeof ran !== 'string') return;

  // Only my build command counts. Every other command is ignored.
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (typeof config.command !== 'string' || ran.trim() !== config.command.trim()) return;

  if (event.hook_event_name === 'PostToolUse') {
    saveFails({ errorKey: '', count: 0, offered: false });
    return;
  }
  if (event.hook_event_name !== 'PostToolUseFailure' || event.is_interrupt === true) return;

  // There is no exit-code field on failure, only: "Exit code N\n<output>".
  const error = typeof event.error === 'string' ? event.error : '';
  const first = error.split(/\r?\n/, 1)[0];
  const exit = /^Exit code (\d+)$/.exec(first.trim());
  if (!exit || Number(exit[1]) === 0) return;

  const errorKey = makeErrorKey(error.slice(first.length));
  const saved = readFails();
  const same = saved.errorKey === errorKey;
  const state = { errorKey, count: same ? saved.count + 1 : 1, offered: same && saved.offered };
  const offer = state.count >= OFFER_AT && !state.offered;
  if (offer) state.offered = true;
  saveFails(state);
  if (offer) console.log(JSON.stringify({ systemMessage: OFFER }));
}

main().then(() => process.exit(0), () => process.exit(0));
