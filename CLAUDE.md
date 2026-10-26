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
- `.stuck-fails.json`: failure counter for the hook.
- `LEARNED.md`: my own sentences from /fixed (append only, only MY words).
- `stuck-log.json`: session log for stats.
- The last four are personal, so they are in `.gitignore`.

## Testing without spending usage

Every script that calls `claude -p` must also accept an environment variable
`STUCK_FAKE_REPLY` (or a `--fake "<text>"` flag). When set, the script uses that text as the model's
reply instead of calling Claude. I test the code checks with fake replies first (a reply
with 12 lines of code, invalid JSON, a missing question mark) and only then try the real model.

## Limits on model calls

- At most 2 `claude -p` calls per command (the first try plus one retry), 60 second timeout.
- If the call fails or times out, print a clear message and exit. Never loop.

## Safety

- Run only the command in `.stuck-config.json`. Never run commands the model suggests.
- The `command` in `.stuck-config.json` is a single string from my own file, run through the shell, and never written by the model.
- Never send anything but the build output and the few lines of source around the error to the model.
- I should check my course's AI policy before using /stuck on graded work. `graded` mode exists for that.

## How to work with me

- One phase at a time (see `BUILD-PLAN.md`). Before a big change, tell me the plan in plain words.
- Don't add features I didn't ask for. Suggest them instead.
- After each change, tell me exactly how to test it, including the fake-reply tests.
- After each change, add a short entry to `LOG.md`: what I asked for, what changed, what I decided, what the model got wrong.
- I make the git commits myself. Don't run `git commit` or `git push`.
