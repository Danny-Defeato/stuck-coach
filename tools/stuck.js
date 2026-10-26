// /stuck: run my build command, then ask the model for a hint at the right level.
// The model only explains the error and writes the hint. Everything else is here.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { MODES, readPolicy } = require('./policy');
const { duckTurn, clearDuck, cleanAnswer, MAX_ANSWER_CHARS } = require('./duck');
const { makeErrorKey } = require('./errorkey');

// Files are found from the folder /stuck is run in, not from where this script lives.
const ROOT = process.cwd();
const CONFIG_FILE = path.join(ROOT, '.stuck-config.json');
const LEVEL_FILE = path.join(ROOT, '.stuck-level');
const LAST_ERROR_FILE = path.join(ROOT, '.stuck-last-error.json');
const MAX_LEVEL = 3;
const TIMEOUT_MS = 60000;
const CONTEXT_BEFORE = 5;
const CONTEXT_AFTER = 4;
const MAX_ERROR_LINES = 40;
const MAX_ERROR_CHARS = 3000;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'out']);

const say = (text) => console.log(text);

// Runs a process, never waits longer than timeoutMs, and always resolves.
function run(file, args, { shell = false, input, cwd, timeoutMs = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, ...result });
    };
    const child = spawn(file, args, {
      shell,
      cwd,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      if (process.platform === 'win32') {
        // /T kills the whole tree, so a java child can't keep the pipes open
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGKILL');
      }
      finish({ timedOut: true });
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (error) => finish({ error }));
    child.on('close', (code) => finish({ code }));
    if (input !== undefined) {
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}

function loadConfig() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    say('Could not read .stuck-config.json. It should look like { "command": "javac -d out examples/TypeMismatch.java" }.');
    return null;
  }
  if (!config || typeof config.command !== 'string' || !config.command.trim()) {
    say('.stuck-config.json needs a "command" that is a non-empty string.');
    return null;
  }
  return config;
}

function readLevel() {
  try {
    const saved = JSON.parse(fs.readFileSync(LEVEL_FILE, 'utf8'));
    if (typeof saved.errorKey === 'string' && Number.isInteger(saved.level)) return saved;
  } catch (e) {
    // missing or broken file: start over
  }
  return { errorKey: '', level: 0 };
}

function saveLevel(errorKey, level) {
  fs.writeFileSync(LEVEL_FILE, JSON.stringify({ errorKey, level }) + '\n');
}

// The same cap everywhere the error text is saved or sent to the model.
function clipError(output) {
  return output.split(/\r?\n/).slice(0, MAX_ERROR_LINES).join('\n').slice(0, MAX_ERROR_CHARS);
}

// /fixed reads this later. A passing build must not delete it: the error I just fixed is what /fixed needs.
function saveLastError(errorKey, output) {
  const clipped = clipError(output);
  const now = new Date();
  const two = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  fs.writeFileSync(LAST_ERROR_FILE, JSON.stringify({ errorKey, output: clipped, date }) + '\n');
}

// The path comes from build output, so it is never trusted: the real path
// (after symlinks) must be inside the working folder.
function isInsideRepo(file) {
  try {
    const rel = path.relative(fs.realpathSync(ROOT), fs.realpathSync(file));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch (e) {
    return false;
  }
}

function findByName(dir, name, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === name) return path.join(dir, name);
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      const found = findByName(path.join(dir, entry.name), name, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function resolveInsideRepo(file) {
  const direct = path.resolve(ROOT, file);
  if (fs.existsSync(direct)) return isInsideRepo(direct) ? direct : null;
  // stack traces only give the file name, so look for it in the repo
  if (path.basename(file) !== file) return null;
  const found = findByName(ROOT, file);
  return found && isInsideRepo(found) ? found : null;
}

// javac prints "path.java:13: error: ...", a stack trace prints "(Name.java:9)".
// The first mentioned .java file that is really inside the repo wins.
function findErrorLocation(output) {
  const pattern = /((?:[A-Za-z]:)?[^\s():]+\.java):(\d+):|\(([\w$]+\.java):(\d+)\)/g;
  for (const m of output.matchAll(pattern)) {
    const file = resolveInsideRepo(m[1] || m[3]);
    if (file) return { file, line: Number(m[2] || m[4]) };
  }
  return null;
}

function sourceAround({ file, line }) {
  let lines;
  try {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  } catch (e) {
    return null;
  }
  const start = Math.max(1, line - CONTEXT_BEFORE);
  const end = Math.min(lines.length, line + CONTEXT_AFTER);
  const shown = [];
  for (let n = start; n <= end; n++) shown.push(`${n}: ${lines[n - 1]}`);
  return `${path.basename(file)}\n${shown.join('\n')}`;
}

const LEVEL_RULES = {
  0: 'Locked mode (explanation only). Explain what the error means in plain words. Do NOT give a hint, advice, what to try, where to look, or the fix. No code.',
  1: 'Level 1 (a nudge). Explain only what the error message literally says, in plain words. Do NOT say what is wrong with the code or why it happens. Then give one nudge about where to look. No code.',
  2: 'Level 2 (the cause). Explain what the error means and why it happens in this code, in plain words. Do NOT show the fix. No code.',
  3: 'Level 3 (the fix). Explain the error, then give the specific fix. At most 3 lines of code.',
};

function buildPrompt(errorText, source, level) {
  const errorLines = clipError(errorText);
  return [
    'You are a hint coach for a student whose Java code will not build or run.',
    'You have no tools and cannot see any other files, so use only the text below.',
    level === 0
      ? 'Write a short plain-words explanation of the real error. Follow the rule below.'
      : 'Write a short plain-words explanation of the real error, then a hint at the level below.',
    LEVEL_RULES[level],
    'Put any code inside ``` fences. Never put code outside fences.',
    '',
    'REAL ERROR OUTPUT:',
    errorLines,
    '',
    source ? `SOURCE AROUND THE ERROR:\n${source}` : '(no source lines available)',
  ].join('\n');
}

// Returns { text } or { failure }. STUCK_FAKE_REPLY replaces the model, so no usage is spent.
async function callModel(prompt) {
  if (process.env.STUCK_FAKE_REPLY) return { text: process.env.STUCK_FAKE_REPLY };
  // --tools "" is its own array element: no tools, no file access.
  // Running from the temp folder keeps this project's CLAUDE.md out of the model's context.
  const r = await run('claude', ['-p', '--tools', ''], { input: prompt, cwd: os.tmpdir() });
  if (r.error && r.error.code === 'ENOENT') return { failure: 'Could not find the `claude` command. Is Claude Code installed and on your PATH?' };
  if (r.error) return { failure: `Could not run claude: ${r.error.message}` };
  if (r.timedOut) return { failure: 'The model did not answer within 60 seconds. Stopped. Try /stuck again.' };
  if (r.code !== 0) return { failure: `claude failed (exit code ${r.code}): ${(r.stderr || r.stdout).trim().split(/\r?\n/)[0]}` };
  return { text: r.stdout };
}

// Counts code lines: everything inside ``` fences, plus unfenced lines that
// look like code (end in ; { or }, or are indented 4+ spaces / a tab).
function countCodeLines(text) {
  let inFence = false;
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!line.trim()) continue;
    if (inFence || /[;{}]$/.test(line.trimEnd()) || /^( {4,}|\t)/.test(line)) count++;
  }
  return count;
}

// The terminal shows ** literally, so drop the bold markers before printing.
// Lines inside code fences are left alone so code is never changed.
function stripBold(text) {
  let inFence = false;
  return text.split('\n').map((line) => {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      return line;
    }
    return inFence ? line : line.replace(/\*\*/g, '');
  }).join('\n');
}

function checkReply(text, level) {
  if (!text.trim()) return { ok: false, problem: 'the reply was empty.' };
  const codeLines = countCodeLines(text);
  const allowed = level === MAX_LEVEL ? 3 : 0;
  if (codeLines > allowed) {
    const name = level === 0 ? 'Locked mode' : `Level ${level}`;
    const rule = allowed === 0 ? `${name} must have no code at all` : `${name} may have at most ${allowed} lines of code`;
    return { ok: false, problem: `the reply had ${codeLines} lines of code. ${rule}.`, codeLines };
  }
  return { ok: true, codeLines };
}

// First try plus at most one retry that tells the model exactly what was wrong.
async function askModel(prompt, level) {
  let problem = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = attempt === 1
      ? prompt
      : `${prompt}\n\nYour previous reply was rejected by a code check: ${problem} Write the whole reply again and fix exactly that.`;
    const reply = await callModel(text);
    if (reply.failure) return { ok: false, message: reply.failure };
    const check = checkReply(reply.text, level);
    if (check.ok) return { ok: true, text: reply.text.trim(), codeLines: check.codeLines };
    problem = check.problem;
  }
  return { ok: false, message: `The model's reply broke the rules twice (${problem}) Nothing was shown and the level was not used up. Run /stuck again to retry.` };
}

const USAGE = 'Usage: node tools/stuck.js   or   node tools/stuck.js --duck [your answer]';

// Reads piped input (used by the slash command so my answer never goes through the shell).
function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null);
    let text = '';
    const timer = setTimeout(() => resolve(null), 5000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { text += d; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(text); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

function answerFrom(raw) {
  const { text, cut } = cleanAnswer(raw);
  return { answer: text, answerCut: cut };
}

// No arguments = normal /stuck. --duck [words] = duck mode, the words are my answer.
// --duck --stdin = duck mode, my answer comes from piped input. Anything else is refused,
// so a typo like --Duck can never silently use up a hint level.
async function parseArgs(args) {
  if (args.length === 0) return { duck: false };
  if (args[0] !== '--duck') return { error: `Unknown argument "${args[0]}". ${USAGE}` };
  if (args[1] !== '--stdin') return { duck: true, ...answerFrom(args.slice(1).join(' ')) };
  if (args.length > 2) return { error: `--stdin takes the answer from piped input, not from the command line. ${USAGE}` };
  const piped = await readStdin();
  if (piped === null) return { error: '--stdin needs piped input (the /stuck command sends it), and none arrived.' };
  return { duck: true, ...answerFrom(piped) };
}

async function main() {
  const parsed = await parseArgs(process.argv.slice(2));
  if (parsed.error) {
    say(parsed.error);
    return 1;
  }
  const config = loadConfig();
  if (!config) return 1;

  const policy = readPolicy();
  const cap = MODES[policy.mode].cap;
  if (policy.warning) say(policy.warning);

  const build = await run(config.command, [], { shell: true });
  if (build.timedOut) {
    say(`The build command did not finish in ${TIMEOUT_MS / 1000} seconds, so I stopped it. Is the program waiting for input?`);
    return 1;
  }
  if (build.error) {
    say(`Could not run the build command: ${build.error.message}`);
    return 1;
  }
  if (build.code === 0) {
    saveLevel('', 0);
    clearDuck(ROOT);
    say('Build passed');
    return 0;
  }
  const output = `${build.stderr}\n${build.stdout}`.trim();
  const notFound = /is not recognized as an internal or external command|command not found/i;
  if (build.code === 9009 || build.code === 127 || notFound.test(output)) {
    say(`The build command could not start (exit code ${build.code}). Check for a typo in .stuck-config.json:\n${config.command}`);
    return 1;
  }
  if (!output) {
    say(`The build command failed (exit code ${build.code}) but printed nothing, so there is no error to explain.`);
    return 1;
  }

  const errorKey = makeErrorKey(output);
  saveLastError(errorKey, output);
  const location = findErrorLocation(output);
  const source = location ? sourceAround(location) : null;

  // Duck mode: questions only, one turn per run. All policy modes allow it, and it never touches the hint level.
  if (parsed.duck) {
    if (parsed.answerCut) say(`(your answer was cut to ${MAX_ANSWER_CHARS} characters)`);
    return duckTurn({ root: ROOT, errorKey, errorText: clipError(output), source, answer: parsed.answer, policy, callModel, countCodeLines, stripBold });
  }

  const previous = readLevel();
  const sameError = previous.errorKey === errorKey;
  // The policy cap is checked here, before any model call. Locked has cap 0: no
  // hint levels at all, so it skips this check and only asks for the explanation (level 0).
  if (cap > 0 && sameError && previous.level >= cap) {
    say(`Mode is ${policy.mode}: hints stop at level ${cap}, and you have used them for this error. No more hints. Change the code or ask your instructor.`);
    return 0;
  }
  const level = cap === 0 ? 0 : sameError ? previous.level + 1 : 1;

  const answer = await askModel(buildPrompt(output, source, level), level);
  if (!answer.ok) {
    say(answer.message);
    return 1;
  }

  // Locked never changes the saved level, so switching back to practice keeps your place.
  if (level > 0) saveLevel(errorKey, level);
  say(stripBold(answer.text));
  say('');
  if (level === 0) {
    say(`[stuck] mode: locked | explanation only | error: ${errorKey}`);
  } else {
    say(`[stuck] level ${level} of ${cap} | mode: ${policy.mode} | code lines: ${answer.codeLines} | error: ${errorKey}`);
  }
  return 0;
}

main().then((code) => { process.exitCode = code; });
