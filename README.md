# stuck-coach

A hint coach for when my Java code won't build or run. Type `/stuck` in Claude Code: it runs my build,
shows the real error, explains it, and gives a hint that gets more specific each time (up to 3 levels).

## Who does what

**The model does only two things**
- Explains the real error in plain words.
- Writes a hint at the level the script asks for.

**The script (`tools/stuck.js`) does everything else**
- Runs the build command from `.stuck-config.json` itself (60 second limit) and passes the real output. The model never guesses the error.
- Tracks the hint level in `.stuck-level`: same error means the next level, a new error starts at level 1, a passing build resets it.
- Picks about 10 lines of source around the error (only files inside this folder) and sends only those plus the error.
- Calls `claude -p` with no tools and no file access.
- Checks every reply: no code at levels 1 and 2, at most 3 lines of code at level 3. If the check fails it retries once, telling the model exactly what was wrong, then gives up with a clear message.
- Reads and writes all files. The model never edits anything.

**Policy modes (`.stuck-policy.json`, change with `/stuck-mode`)**
- `practice`: hints up to level 3. `graded`: hints stop at level 2. `locked`: explanation only, no hints.
- The script checks the cap before it calls the model. When the cap is reached it prints a message and makes no model call. Locked has no hint levels, so it asks the model only for the plain-words explanation.
- A missing policy file means practice. A broken file or unknown mode falls back to locked and says so.
- The policy file is a nudge, not security. It is a plain file on my own computer, so I (or any student) can edit it. It helps me stay inside my course's AI rules; it does not enforce them.
- The script also removes `**` bold markers from the reply before printing (code inside fences is left alone).

**`/fixed` (run `node tools/fixed.js` in a terminal after the bug is fixed)**
- `/stuck` saves the last failing build in `.stuck-last-error.json`. A passing build does not delete it.
- The script reads `git diff HEAD -- "*.java"` itself (staged and unstaged changes to `.java` files). Brand-new untracked files are not included. If the folder is not a git repo, or nothing changed, it says so and stops.
- It asks me for one sentence on what was wrong. The code refuses it before any model call if it is under 4 words or shares no word of 4+ letters with the error message or the changed (`+`/`-`) lines. A short stoplist (error, symbol, fixed, wrong, ...) does not count as sharing.
- **The model's only job:** answer `{"matches": true or false, "feedback": "one sentence"}` for my sentence, the error and the diff (capped at 80 lines / 4000 characters). Code validates the JSON (boolean `matches`, one short sentence of feedback with no code), retries once with the exact problem, then gives up. At most 2 model calls per run in total.
- If it matches, the script appends the date, the error and **my** sentence to `LEARNED.md` (personal, in `.gitignore`). Nothing the model wrote is ever saved. If not, I see the feedback and get one more try.
- It is terminal only because it needs me to type a line, and the slash command's shell has no keyboard input.

**Duck mode (`/stuck --duck`)**
- The model only asks questions about the real error, one at a time, building on my last answer. It never gives hints or code. Each run is one question; my answer goes in the next run: `/stuck --duck <my answer>` (terminal: `node tools/stuck.js --duck "my answer"`, in quotes for PowerShell).
- It is a switch on `/stuck`, not a policy mode: policy modes cap how many hints I may get, and duck mode gives none, so practice, graded and locked all allow it. It never changes the hint level.
- **Code checks every reply before it is printed:** under 300 characters; no code; every sentence ends in `?` (no statements, greetings or advice); at most 3 questions; none of the common leading patterns ("have you tried...", "why not...", "shouldn't it...", "you should change..."). A bad reply is retried once with the exact problem (2 model calls per run at most), then it gives up with a clear message. My answer is kept either way.
- The conversation is in a temp file (outside the repo). It starts over when the error changes and is deleted when the build passes. After 6 questions it says to try plain `/stuck` (no model call).
- In `/stuck --duck <answer>` my answer reaches the script through piped input, never through the shell, so quotes and symbols in it can't run anything.
- **Limit:** code can prove a reply is only questions with no code. It cannot prove a question doesn't *hint* at the fix. The blocklist catches the common patterns and the prompt does the rest, so a leading question that slips through is the model's fault.

**Auto-offer hook (`tools/hook-build.js`, set up in `.claude/settings.json`)**
- This part is 100% code, the model is never involved. A hook is a command Claude Code itself runs at a fixed moment, every time. An instruction in `CLAUDE.md` is only text the model reads and may or may not follow.
- After my build command runs through Claude Code, the hook gets the result on stdin as JSON. It counts consecutive failures of the same error in `.stuck-fails.json` and prints `Build failed 3 times in a row. Type /stuck for a hint.` once, on the third. A different error or a passing build resets the count. It never runs the build and never calls the model.
- It fails open: bad input or any error means exit 0 and no output. It only reacts to the exact command in `.stuck-config.json`.
- **Limits:**
  - The hook only sees builds Claude Code runs through its Bash/PowerShell tool, not builds I run in my own terminal, and not the build that `/stuck` runs inside its script.
  - "3 in a row" counts only failures the hook saw.
  - The path `node tools/hook-build.js` is relative. If Claude's shell leaves the repo folder, the hook cannot find the file and shows a hook error, so it is not fully fail-open in that case.
- Turn it off: delete the two `hooks` entries in `.claude/settings.json`, or add `"disableAllHooks": true` there.

If a hint reveals too much, that was the model. If the level, a check or a crash is wrong, that was my code.

See `CLAUDE.md` for the rules and how to run and test it, and `LOG.md` for what I decided.
