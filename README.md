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

If a hint reveals too much, that was the model. If the level, a check or a crash is wrong, that was my code.

See `CLAUDE.md` for the rules and how to run and test it, and `LOG.md` for what I decided.
