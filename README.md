# Hint Coach (stuck-coach)

New here? Start with the [step-by-step tutorial](TUTORIAL.md).

## What it is

Hint Coach is a Claude Code command (/stuck) that helps a student whose Java code won't build. It runs the build itself, then asks a model to explain the real error in plain words and give a hint that gets more specific each time it's used. Plain code decides how much help is allowed and checks that the model never hands over the whole answer. Its goal is to help students learn from their errors instead of just getting the fix.

## What the model does vs what the code checks

The model is only called through `claude -p` with no tools and no file access. It gets text and returns text. Everything else is plain code.

| Part | The model does | The code does |
|---|---|---|
| `/stuck` | Explains the real error in plain words. Writes a hint at the level the script asks for. | Runs the build from `.stuck-config.json` itself (60 second limit) and passes the real output. Tracks the level in `.stuck-level` (same error = next level, new error = level 1, a passing build resets it). Sends only the error and about 10 lines of source around it (only files inside this folder). Checks every reply: no code at levels 1 and 2, at most 3 lines of code at level 3 (unfenced code-looking lines count). Retries once with the exact problem, then gives up with a clear message. Strips `**` from the reply. Reads and writes all files. |
| Policy modes | Nothing extra. In locked mode it writes only the explanation. | Reads `.stuck-policy.json` and checks the cap (practice 3, graded 2, locked explanation only) before any model call. A missing file means practice. A broken file or unknown mode means locked, with a message. |
| `/fixed` | Judges whether my one sentence matches the error and the diff, and answers `{"matches": true/false, "feedback": "one sentence"}`. | Reads `git diff HEAD -- "*.java"` (capped at 80 lines / 4000 characters). Refuses a lazy sentence before any model call (under 4 words, or no word of 4+ letters shared with the error or the changed lines). Validates the JSON, retries once, at most 2 model calls per run. Appends only MY sentence to `LEARNED.md`. |
| Duck mode (`/stuck --duck`) | Asks one question about the real error, building on my last answer. | Keeps the conversation in a temp file. Checks every reply: under 300 characters, no code, every sentence ends in `?`, at most 3 questions, none of the common leading patterns. Retries once, then gives up. Stops after 6 questions. Passes my answer in through stdin, not the shell. |
| Auto-offer hook | Nothing. The hook makes no model call. | Counts consecutive failures of the same error, resets on a pass or a new error, prints the offer once on the 3rd failure, fails open. |

If a hint reveals too much, that was the model. If the level, a check or a crash is wrong, that was my code.

## Commands

- **`/stuck`**: runs the build and gives the hint for the next level. Terminal: `node tools/stuck.js`. To start fresh, delete `.stuck-level`. The build command is in `.stuck-config.json`.
- **`/stuck-mode`**: shows the policy mode. `/stuck-mode practice|graded|locked` changes it (terminal: `node tools/stuck-mode.js [mode]`). The policy file is a nudge, not security (see the limits).
- **`node tools/fixed.js`**: run it in a terminal after the bug is fixed. It asks for one sentence on what was wrong, checks it in code, asks the model only whether it matches, and appends my sentence to `LEARNED.md`. Terminal only, because it needs me to type a line and the slash command's shell has no keyboard input.
- **`/stuck --duck`**: asks the next question, no hints and no code. Answer with `/stuck --duck <your answer>`, or in a terminal `node tools/stuck.js --duck "your answer"` (in quotes for PowerShell). It is a switch on `/stuck`, not a policy mode: every mode allows it and it never changes the hint level.
- **Auto-offer hook** (`tools/hook-build.js`, set up in `.claude/settings.json`): after my build command runs through Claude Code, it counts failures of the same error and offers `/stuck` on the 3rd. It also hands Claude Code a fixed sentence to relay; the model may reword or skip it. To turn it off, delete the two `hooks` entries in `.claude/settings.json`, or add `"disableAllHooks": true` there.

## Demo

A real session on `examples/TypeMismatch.java` (build command `javac -d out examples/TypeMismatch.java`), run on 2026-10-25 with the real model. The mode was set to graded for the first part. Output is copied as printed.

```
> node tools/stuck-mode.js graded
Mode is now graded: hints stop at level 2 (no fix)

> node tools/stuck.js
The compiler is telling you that on line 13, you gave it a whole number (an `int`), but the spot where that value goes expects text (a `String`). It points at the call to `findIndex(name)` as the place where the number comes from.

Nudge: Compare the type that `findIndex` hands back with the type that `lookup` on line 12 promises to return.

[stuck] level 1 of 2 | mode: graded | code lines: 0 | error: incompatible types: int cannot be converted to String

> node tools/stuck.js
What the error means: The compiler is telling you that the method `lookup` promises to hand back a `String`, but the value you're returning on line 13 is an `int`. Java won't quietly turn a number into text for you, so it stops.

Why it happens here: Look at the two methods side by side.

- `findIndex` is declared to return an `int`. It asks the list where `name` sits and gives back that position, which is a number.
- `lookup` is declared to return a `String`. Its `return` line passes along whatever `findIndex` gives it, which is that number.

So the `return` statement hands an `int` to a method that was set up to give back a `String`. The caret in the error points at the call to `findIndex(name)` because that is the expression whose type (`int`) doesn't match what `lookup` said it would return (`String`).

Hint for thinking about it: Ask what `lookup` is supposed to produce. Is it meant to give back a position (a number), or a piece of text? Once you decide that, one of the two things has to change so the promised type and the returned type agree: either what the method promises, or what it actually returns.

[stuck] level 2 of 2 | mode: graded | code lines: 0 | error: incompatible types: int cannot be converted to String

> node tools/stuck.js
Mode is graded: hints stop at level 2, and you have used them for this error. No more hints. Change the code or ask your instructor.
```

The third run is the cap: the script stopped it and made no model call.

Locked mode, same file. It gives the explanation and no hint, and the footer shows no level:

```
> node tools/stuck-mode.js locked
Mode is now locked: explanation only, no hints

> node tools/stuck.js
The method `lookup` is declared to give back a `String` (text). But on line 13, it returns the result of `findIndex(name)`, and `findIndex` is declared to give back an `int` (a whole number). Java won't treat a number as text on its own, so it stops. The compiler is saying that the value being returned is a number, while the method promised to return text.

[stuck] mode: locked | explanation only | error: incompatible types: int cannot be converted to String
```

A real `LEARNED.md` entry, written by `node tools/fixed.js` after I fixed this error (my words, not the model's):

```
## 2026-10-25 - incompatible types: int cannot be converted to String
The lookup method is a string method, while findIndex is a int method. To return a string value using lookup, you would need to use String.valueOf to get the string value of whatever findIndex returns.
```

## Tested vs not tested

Details and dates are in `LOG.md`.

**Fake-reply rejection tests (`STUCK_FAKE_REPLY`, no model): bad replies the code must refuse**
- `/stuck`: 12 fenced code lines rejected twice (retry once, then a clear message); unfenced code lines rejected.
- `/fixed`: lazy sentences refused with nothing saved; invalid JSON, a string `matches`, code in the feedback, two-line and over-long feedback all rejected; the retry text contains the exact problem.
- Duck mode: a statement, a statement plus a question, 4 questions, a code fence, indented code, over 300 characters, leading questions and an empty reply are each rejected, retried once, then fail with a clear message after exactly 2 calls.
- Hook: empty and bad stdin, `null`, other tools, other commands, no exit-code line, interrupt, missing or broken config and an unwritable fails file all exit 0 with no output.

**Fake-reply tests of the other code (no model)**
- `/stuck`: levels 1, 2, 3 then the last-level message; a new error restarts at level 1; a passing build resets; a runtime error is caught; a typo in the build command; the 60 second build timeout; source paths outside the repo ignored.
- Policy modes: the cap, the locked footer, a missing, broken and unknown-mode policy file.
- `/fixed`: `matches: false` then a retry, the diff cap, empty diff, not a git repo, no saved error.
- Duck mode: the 6-question limit; answers with quotes, `$(...)`, backticks, `;`, `|` and `>` arrive unchanged through `--stdin` and run nothing.
- Hook: JSON piped into the script in a temp folder. Offer on the 3rd failure only, reset on a pass or a new error.

**Real-model runs**
- `/stuck` at levels 1, 2 and 3 and in locked mode, and the graded cap (the demo above is a real run).
- `/fixed` wrote the real `LEARNED.md` entry above.
- Duck mode: 9 real calls happened by mistake during testing and all 9 replies were valid questions. That is not a proper test (see `LOG.md`).
- Real runs found problems the checks did not stop. See "What the model got wrong" in `LOG.md`.

**Verified in a live Claude Code session (hook)**
- At 9:36 PM the auto-offer hook showed the box, Claude repeated the sentence, and it worked through both the Bash and PowerShell tools.
- Claude only relays a sentence the code wrote. It may reword it or skip it, and that would be the model, not the code.

**Verified in a live Claude Code session (duck mode answers)**
- The slash-command layer of `/stuck --duck <answer>` (Claude Code building the heredoc and the permission prompt) works in a live session, with apostrophes in the answer.

**Never tested**
- Any language other than Java.
- The hook: `/hooks` listing both entries, and what happens when Claude's shell leaves the repo folder (the relative path `node tools/hook-build.js`).
- A full 6-question duck session with the real model.
- Whether the real model ever breaks the reply rules in a way the checks miss over many runs.

## Honest limits

- **The policy file is a nudge, not security.** It is a plain file on my own computer, so I (or any student) can edit it. It helps me stay inside my course's AI rules; it does not enforce them.
- **Code can't prove a hint or question avoids leaking the answer.** The checks prove "no code over the limit", and for duck mode "only questions, no statements". A hint in plain words, or a cleverly worded leading question, can still point at the fix. That would be the model.
- **The hook only sees builds Claude Code runs** through its Bash/PowerShell tool, not builds I run in my own terminal and not the build `/stuck` runs inside its script. "3 in a row" counts only failures the hook saw. The path `node tools/hook-build.js` is relative, so if Claude's shell leaves the repo folder the hook shows an error instead of failing open.
- **Untracked files aren't in `/fixed`'s diff.** It uses `git diff HEAD -- "*.java"`, so brand-new files git doesn't track are left out. If the folder isn't a git repo, it says so and stops.
- Check your course's AI policy before using `/stuck` on graded work. `graded` mode exists for that.

## Not built / next

- Other languages (an error parser for each language).
- A terminal watcher, so the offer works for builds I run outside Claude Code.
- `stuck` as a global command, instead of only inside this folder.

See `CLAUDE.md` for the rules and how to run and test it, and `LOG.md` for what I decided.
