# stuck-coach

A hint coach for when my Java code won't build or run. It is a Claude Code slash
command (`/stuck`) plus small Node scripts. Built for TCSS 490 Artifact 3
("a model does some of the work every time it runs"). I'm the only user.

## The one rule: the model's part is small, and code checks it

The model does **only** these things:
- Explains the real error in plain words.
- Writes a hint at the level the script asks for.
- (later phases) reads my one-sentence "what I learned", asks a duck-mode question, labels an error category.

The code does **everything else**, and never asks the model for permission:
- Runs the build or program itself and passes the real output (the model never guesses the error).
- Tracks the hint level, resets it when the error changes.
- Enforces the policy mode (cap on levels) from `.stuck-policy.json`.
- Checks every model reply (at most 3 lines of code, a question mark in duck mode, valid JSON, labels from the fixed list), retries ONCE with the exact problem, then gives up with a clear message.
- Reads and writes all files. The model never edits my files.

If something is wrong, I should be able to say "that was the model" or "that was my code".
Keep this split true. If a change would blur it, stop and tell me.

## Stack and structure

- Node.js, no npm packages, no build step. Scripts in `tools/`.
- Slash commands in `.claude/commands/` (markdown files). Hooks in `.claude/settings.json`.
- The model is called ONLY through `claude -p` (headless Claude Code) from the scripts. No API keys, nothing paid.
- `claude -p` is always called with no tools and no file access: the scripts pass `--tools ""` (confirmed in `claude -p --help`: `Use "" to disable all tools`). The model only gets the text the script sends and returns text.
- The scripts must pass `--tools ""` as its own element in an args array (`spawn` or `execFile`), never inside a single command string, because Windows quoting of an empty string is unreliable.
- Must work on Windows (my computer), so no bash-only tricks: use Node for anything a hook or script runs.
- Practice files in `examples/` (compile errors on purpose). The build command lives in `.stuck-config.json`, e.g. `{ "command": "javac -d out examples/TypeMismatch.java" }`.

## Files the scripts own

- `.stuck-config.json`: the build/run command.
- `.stuck-level`: JSON `{ "errorKey": "...", "level": 0-3 }`.
- `.stuck-policy.json`: `{ "mode": "practice" | "graded" | "locked" }` (practice max level 3, graded max level 2, locked = explain only).
- `.stuck-last-error.json`: `{ "errorKey", "output", "date" }`, the last failing build, saved by `/stuck` for `/fixed`. A passing build does not delete it.
- `stuck-duck-<hash>.json` (in the OS temp folder, not in the repo): the duck-mode conversation, `{ "errorKey", "turns": [{ "q", "a" }] }`. Deleted when the build passes; starts over when the error changes.
- `.stuck-fails.json`: failure counter for the hook.
- `LEARNED.md`: my own sentences from /fixed (append only, only MY words).
- `stuck-log.json`: session log for stats.
- The last five are personal, so they are in `.gitignore`.

## Testing without spending usage

Every script that calls `claude -p` must also accept an environment variable
`STUCK_FAKE_REPLY` (or a `--fake "<text>"` flag). When set, the script uses that text as the model's
reply instead of calling Claude. I test the code checks with fake replies first (a reply
with 12 lines of code, invalid JSON, a missing question mark) and only then try the real model.

## Running it

- In Claude Code: `/stuck` (runs `node tools/stuck.js`, shows its output as printed).
- Directly in a terminal: `node tools/stuck.js`
- Try other practice files by changing `command` in `.stuck-config.json`. `NullPointer.java` needs `javac -d out examples/NullPointer.java && java -cp out NullPointer`.
- Start a fresh run by deleting `.stuck-level`.
- After fixing a bug: `node tools/fixed.js` in a terminal (terminal only, there is no slash command: it needs my typing). It asks for one sentence, checks it in code, asks the model only whether it matches, and appends MY sentence to `LEARNED.md`. Max 2 `claude -p` calls per run, retries included. Test it without usage: `$env:STUCK_FAKE_REPLY = '{"matches":true,"feedback":"Yes."}'`, run `node tools/stuck.js` on a failing build first, change the `.java` file, then `node tools/fixed.js`.
- Duck mode (questions only, no hints, no code): `/stuck --duck` asks the next question. Answer with `/stuck --duck <your answer>`, or in a terminal `node tools/stuck.js --duck "<your answer>"` (quote it in PowerShell). One run = one question = at most 2 `claude -p` calls. After 6 questions it says to try plain `/stuck`. It is a switch on `/stuck`, not a policy mode: every policy mode allows it and it never changes `.stuck-level`. Test without usage: `$env:STUCK_FAKE_REPLY = "What does the compiler say it found?"`, then `node tools/stuck.js --duck`; a reply with a statement, code, or 4 questions must be rejected, retried once, then fail with a clear message.
- Auto-offer hook: `.claude/settings.json` runs `node tools/hook-build.js` after the build command runs through Claude Code (PostToolUseFailure counts failures, PostToolUse resets on a pass). Code only, no model call, fails open. After 3 failures of the same error in a row it prints the offer once. Off: delete the two `hooks` entries (or add `"disableAllHooks": true`). Test without Claude Code: pipe JSON into it, e.g. `'{"hook_event_name":"PostToolUseFailure","tool_name":"Bash","tool_input":{"command":"<build command>"},"error":"Exit code 1\nX.java:3: error: boom"}' | node tools/hook-build.js` (run it in a temp folder with its own `.stuck-config.json` via `$env:CLAUDE_PROJECT_DIR`).
- Show or change the policy mode: `/stuck-mode` or `node tools/stuck-mode.js [practice|graded|locked]`. Locked prints `[stuck] mode: locked | explanation only | error: ...` instead of a level line.

Fake-reply test, no usage spent (PowerShell). A 12-line code block at level 1 must be rejected, retried once, then fail with a clear message:

```powershell
Remove-Item .stuck-level -ErrorAction SilentlyContinue
$env:STUCK_FAKE_REPLY = "``````java`n" + ((1..12 | % { "int x$_ = $_;" }) -join "`n") + "`n``````"
node tools/stuck.js
Remove-Item Env:STUCK_FAKE_REPLY
```

A good fake (`$env:STUCK_FAKE_REPLY = "Plain words, no code."`) prints the reply and a `[stuck] level N of 3` line. Unfenced lines that end in `;` `{` `}` or are indented 4+ spaces count as code too.

## Limits on model calls

- At most 2 `claude -p` calls per command (the first try plus one retry), 60 second timeout.
- If the call fails or times out, print a clear message and exit. Never loop.

## Safety

- Run only the command in `.stuck-config.json`. Never run commands the model suggests.
- The `command` in `.stuck-config.json` is a single string from my own file, run through the shell, and never written by the model.
- Never send anything but the build output and the few lines of source around the error to the model. The one exception is `/fixed`: it also sends `git diff HEAD -- "*.java"` (uncommitted `.java` changes only), capped at 80 lines / 4000 characters, plus my one-line sentence. Duck mode (`--duck`) also sends my earlier answers (300 characters each) and the model's earlier questions, at most 6 of each.
- I should check my course's AI policy before using /stuck on graded work. `graded` mode exists for that.

## How to work with me

- One phase at a time (see `BUILD-PLAN.md`). Before a big change, tell me the plan in plain words.
- Don't add features I didn't ask for. Suggest them instead.
- After each change, tell me exactly how to test it, including the fake-reply tests.
- After each change, add a short entry to `LOG.md`: what I asked for, what changed, what I decided, what the model got wrong.
- I make the git commits myself. Don't run `git commit` or `git push`.
