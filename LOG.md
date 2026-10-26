# Log: plans and changes

What I set out to build, what I asked the agent for, what I decided, and what I dropped.

## 2026-10-19: Plan

**Goal:** a hint coach for my Java homework. When my code won't build or run, `/stuck` shows me the real error, explains it, and gives a hint that gets more specific each time I ask, without handing over the answer.

**Why this fits the assignment:** the model has one small job (explain and hint). Everything that has to be exactly right is plain code: running the build, the hint level, the policy cap, and checking the model's reply.

**Decisions**
- Slash command plus Node scripts that call `claude -p`. No API key, nothing paid.
- Code owns the rules (levels, caps, line limits); the model never decides how much help I get.
- Policy modes (practice / graded / locked) so I can stay inside my courses' AI rules.
- Built in phases with Claude Code, one feature per phase, testing and committing after each (see `BUILD-PLAN.md`).
- Test the code checks with fake model replies before using the real model.

**Planned phases:** core /stuck, policy modes, auto-offer hook, /fixed, duck mode. Stats dashboard only if time allows.

**Dropped for now:** a web dashboard, support for languages other than Java, anything that edits my files.

## 2026-10-25: CLAUDE.md safety rules

**Asked for:** two of five suggested changes to CLAUDE.md (3 and 4); skipped 1, 2 and 5.

**Changed**
- Stack and structure: `claude -p` is always called with no tools and no file access, using `--tools ""` (checked against `claude -p --help`, not guessed).
- Stack and structure: scripts must pass `--tools ""` as its own element in an args array (`spawn`/`execFile`), never inside one command string, because Windows quoting of an empty string is unreliable.
- Safety: the `.stuck-config.json` command is one string from my own file, run through the shell, never written by the model.

**Decided:** the empty-string quoting rule is written down now so the first script gets it right. Suggestions 1, 2 and 5 are not done.

**What the model got wrong:** nothing yet. No scripts exist, so the flag is untested until the first `claude -p` call is written.

## 2026-10-25: Phase 1, core /stuck

**Asked for:** BUILD-PLAN Phase 1, plus: `--tools ""` as its own args element, `STUCK_FAKE_REPLY`, run commands and fake test in CLAUDE.md. After the plan I added: count unfenced code-looking lines, tell the model to fence code and (level 1) only restate what the error literally says, only read source files inside the repo, 60 second build timeout, `allowed-tools` in the command file.

**Changed:** new `tools/stuck.js` and `.claude/commands/stuck.md`; README has the model/script split; CLAUDE.md has "Running it".

**Decided**
- The level is saved only after a good reply, so a model failure does not use up a hint.
- `claude -p` runs from the temp folder so this project's CLAUDE.md is not sent to the model.
- A build command that cannot start (typo) stops with a message instead of being sent to the model.

**Tested with fake replies:** 12 fenced code lines rejected twice; unfenced code lines rejected; levels 1, 2, 3 then "last level"; MissingReturn restarts at level 1; Clean resets; NullPointer runtime error caught; typo command; 60 second build timeout; paths outside the repo ignored.

**What the model got wrong:** not tested with the real model yet. Fill this in after the first real run.

## 2026-10-25: Phase 2, policy modes

**Asked for:** BUILD-PLAN Phase 2 (practice cap 3, graded cap 2, locked explain-only; cap enforced by the script before any model call; a command to show or change the mode), plus stripping `**` from the reply before printing. After the plan I added: locked footer is `[stuck] mode: locked | explanation only | error: ...`, a locked-mode test where both tries are rejected, the README says the policy file is a nudge and not security, and no new files beyond the plan.

**Changed:** new `tools/policy.js` (modes, reading the file, fallback), `tools/stuck-mode.js` and `.claude/commands/stuck-mode.md` (show or set the mode); `tools/stuck.js` checks the cap, has a level 0 for locked, and `stripBold()`; README, CLAUDE.md and `.gitignore` (policy file is personal).

**Decided**
- Locked still calls the model once for the explanation, because only the model can write it. "No model call" applies to the hint cap (graded at level 2).
- A missing policy file means practice. A broken file or unknown mode means locked, with a message.
- Locked never changes `.stuck-level`, so switching back to practice keeps my place.
- The policy file is a nudge, not security: I can edit it myself.
- `**` is stripped only outside code fences, so code is never changed.

**What the model got wrong:** nothing from the real model yet (all tests used fake replies). One thing the code cannot check: in locked mode it can reject code, but not "try this" advice in plain words. That depends on the prompt alone. My own agent mistake: while editing `.gitignore` I added the policy line twice and had to remove one.

## 2026-10-25: Phase 3, auto-offer hook

**Asked for:** BUILD-PLAN Phase 3: a hook in `.claude/settings.json` that runs `node tools/hook-build.js` after my build command, counts consecutive failures of the same error in `.stuck-fails.json`, and prints "Build failed 3 times in a row. Type /stuck for a hint." No model call. Hard rules I added: never run the build, fail open (any error means exit 0 and no output), react only to the build command in `.stuck-config.json`, offer at most once per error, fast, show the exact diff and how to turn it off, say how the input arrives on Windows, test without a real Claude Code session. I asked for the plan first and no files until I approved it. After the plan I asked for a bracket fix in the settings diff, a check that the Phase 1 fake tests still pass after moving `makeErrorKey`, and the three limits below in README and LOG.

**Changed:** new `tools/hook-build.js` and `tools/errorkey.js`; `tools/stuck.js` now requires `makeErrorKey` from `errorkey.js` (same code, moved); new `.claude/settings.json`; `CLAUDE.md` and `README.md` updated.

**Decided**
- **Two hook events, one script.** `PostToolUseFailure` fires when the command exits non-zero and carries `error` = `"Exit code N\n<output>"`; `PostToolUse` fires only on success. The count needs the first, the reset on a pass needs the second (silent).
- **Input arrives on stdin** as one JSON object (not argv or env). There is no numeric exit-code field on failure, so code reads the first line (`Exit code N`).
- **Offer shown with `systemMessage`** (JSON on stdout, exit 0), because plain stdout on exit 0 does not reach the screen for these events. **Not yet confirmed in a real session** (see below).
- `makeErrorKey` moved to its own file so `/stuck` and the hook can never make different keys for the same error.
- Offered once per error: the saved `offered` flag. A different error or a pass clears it.
- Message text is the Phase 3 wording, not the shorter example.
- Turn off: delete the two `hooks` entries, or add `"disableAllHooks": true`.

**Limits (known, on purpose)**
- The hook only sees builds Claude Code runs through its Bash/PowerShell tool, not builds I run in my own terminal, and not the build `/stuck` runs inside its script.
- "3 in a row" counts only failures the hook saw.
- The hook path `node tools/hook-build.js` is relative. If Claude's shell leaves the repo folder, the hook cannot find the file and Claude Code shows a hook error, so it is not fully fail-open in that case.

**Tested without Claude Code** (JSON piped into the script, temp project folder): offer on the 3rd failure only, then silent on the 4th and 5th; a different error restarts at 1; a pass resets and a new run of 3 offers again; other commands (`node tools/stuck.js`, `ls`) leave the file untouched; empty stdin, bad JSON, `[]`, `null`, unknown tool or event, `Exit code 0`, interrupt, non-string error, bad or missing config, unwritable and broken fails file all exit 0 with no output; each run about 70-100 ms; the saved key matches `makeErrorKey`. Phase 1 fake tests after moving `makeErrorKey`: 12 code lines rejected twice, levels 1/2/3 then the last-level message, MissingReturn restarts at 1, Clean resets, NullPointer runtime error caught, typo command, level 3 allows 3 code lines.

**Not tested yet:** a real Claude Code session. Still to check by hand: `/hooks` lists both entries, the offer line really shows on the 3rd failure, and the relative path works.

**What the model got wrong:** nothing from the real model, it is not involved in the hook. My own agent mistakes: (1) one placeholder test in my first Phase 1 run did nothing, so I re-ran it properly. (2) You said a `]` was missing in the settings diff; I compared the plan's diff and found the brackets balanced, so I wrote the file with the same structure and checked it with `JSON.parse` (it printed `valid`).

## 2026-10-25: Phase 4, /fixed

**Asked for:** BUILD-PLAN Phase 4 (`node tools/fixed.js`: my own sentence, code checks it, the model only says whether it matches, only MY sentence goes to `LEARNED.md`). I asked for the plan first and no files until I approved it, and for the model's part to be as small as possible. After the plan I decided: save the last error in `.stuck-last-error.json` (a passing build keeps it), send only a capped source-only diff (80 lines / 4000 characters) and update the Safety line, a stoplist for the word check counting only the error message and the changed `+`/`-` lines, one shared budget of 2 model calls, terminal only, and `git diff HEAD` so staged changes count.

**Changed:** new `tools/fixed.js`; `tools/stuck.js` now also writes `.stuck-last-error.json` after a failed build (one function, one call); `.gitignore`, `CLAUDE.md` (files list, Safety line, Running it) and `README.md` updated.

**Decided**
- Terminal only, no `.claude/commands/fixed.md`: the slash command's shell has no keyboard input, and passing my sentence as a shell argument risks quoting and injection problems on Windows.
- The model's part is only `matches` plus one sentence of feedback. The word check, the length and shape checks on the JSON, the diff cap and the file writes are all code.
- The 2-call budget is strict. If the first sentence used a retry (2 calls) and the answer was "no", the second sentence is not checked and the script says to run it again. (My plan said "no retry for the second sentence", which would not have fitted in 2 calls.)
- Lazy sentences are refused by code and cost no model call; 3 refusals stop the run.
- `git diff HEAD` leaves out brand-new untracked files (written in the README).

**Tested with fake replies:** "I fixed it" and other lazy lines refused with nothing saved; good sentence saved with only my words; `matches: false` twice (feedback, one more try, nothing saved); invalid JSON, string `matches`, code in feedback, two-line feedback and over-long feedback all rejected; retry text checked with a scripted harness (it contains the exact problem); false then true saves only the second sentence; bad JSON then true; diff cap (150 added lines cut, `(diff cut)` added); empty diff; not a git repo; no saved error; stdin closed; a passing build keeps `.stuck-last-error.json`; `/stuck` still passes its Phase 1 checks (good fake, 12-line code block rejected twice).

**What the model got wrong:** not tested with the real model yet. Fill this in after the first real run. My own agent mistake: my plan's budget wording did not add up (see above) and I caught it while writing the tests.

## 2026-10-25: Phase 5, duck mode

**Asked for:** BUILD-PLAN Phase 5, `/stuck --duck`: the model only asks questions, the conversation is kept in a temp file, the code checks every reply (retry once, shared 2-call budget), and it stops after 6 questions. Added to the brief: the reply must be only questions (every sentence ends in "?"), at most 3, no code lines, and no statement of the fix. I asked for the plan first and no files until I approved it, and asked which mode setting it belongs under. I added a cut rule: if the `--stdin` answer path gave trouble in testing, drop it and make answers terminal-only.

**Changed:** new `tools/duck.js` (the temp file, the prompt, the reply check); `tools/stuck.js` (argument parsing, optional piped input, clears the duck file on a pass, hands over to duck mode before the hint-level logic, one shared `clipError()` for the error-text cap); `.claude/commands/stuck.md` (accepts `--duck [answer]`); `CLAUDE.md` and `README.md` updated.

**Decided**
- **A separate switch on /stuck, not a policy mode.** A policy mode is a cap on hint levels (what my course allows). Duck mode gives no answers, so it fits under every mode, including locked, and never touches `.stuck-policy.json` or the hint level.
- **One question per run.** CLAUDE.md allows at most 2 `claude -p` calls per command and says never loop, so a run asks one question and stops; my answer goes in the next run. That is why the conversation is in a temp file (`stuck-duck-<hash>.json` in the OS temp folder, outside the repo).
- The 2-call budget is per run: first try plus one retry. My answer is saved before the model call, so a model failure does not lose it.
- **Answer input:** terminal `node tools/stuck.js --duck "my answer"`, and for the slash command the answer is piped to the script through a quoted heredoc (`--duck --stdin`) so the shell never interprets it. I tested the script side with quotes, `$(...)`, backticks, `;`, `|`, `>` and a multi-line answer: everything arrived verbatim and nothing ran. **The cut rule was not triggered**, so `--stdin` stays. What I could not test is the slash command layer itself (Claude Code building that heredoc and the permission prompt), because it would use a real Claude Code turn and the real model. If it misbehaves, the fallback is already in place: delete `--stdin` from the script and `stuck.md`, and answer only in the terminal; `/stuck --duck` with no answer keeps working in the slash command.
- Any argument other than `--duck` is refused, so a typo like `--Duck` cannot silently use up a hint level.
- Answers are one line, capped at 300 characters, and say so when cut.

**Tested with fake replies:** first question printed with footer; unanswered question re-shown with no model call; answer builds the next question (prompt contains my answer); reply rejected, retried once with the exact problem, then a clear message, with nothing printed and exactly 2 calls: statement, statement plus question, 4 questions, code fence, indented code, over 300 characters, leading questions, empty reply; a bad reply then a good one passes on the retry; model failure keeps my answer; 6 questions then "try plain /stuck" with no call; an answer with no question waiting is refused; graded, locked and a broken policy file all work; a new error starts over; a passing build deletes the temp file; `.stuck-level` is not changed by duck mode; the PowerShell terminal path; Phase 1-2 regressions (good fake, 12 code lines rejected twice, locked footer, graded cap).

**What the model got wrong:** the checks were only run against fake replies on purpose. Two things came out of testing my own code, not the model: (1) my first leading-question blocklist missed "Shouldn't findIndex return a String?" because it only matched "shouldn't it/you/this"; I widened it and re-tested. (2) The code **cannot** prove a question doesn't hint at the fix. It proves "only questions, no code, no statements" and blocks common leading patterns; a cleverly worded leading question can still get through, and then that is the model.

**My own agent mistake:** the first run of the rejection tests silently used the real model. My test harness failed to patch the copy of the script (a shell variable was not exported) and the script kept going, so 9 real `claude -p` calls were made instead of fakes. I fixed the harness, made it refuse to run without scripted replies, and re-ran everything. Side result: all 9 real replies were valid questions and were printed (I did not count retries), so there is no evidence yet of the real model breaking the rules. A proper real-model session of 6 questions is still to do.

## 2026-10-25: Hook offer message

**Asked for:** change only the offer text in `tools/hook-build.js` to a short multi-line plain-ASCII message that stands out (a line of `=`, `STUCK? The build failed 3 times in a row.`, `Type /stuck for a hint.`, another line of `=`). Logic unchanged: once, only on the 3rd failure, fail open. Show the diff before saving, run the hook tests, no commit.

**Changed:** `tools/hook-build.js` only: `OFFER` is now four lines joined with `\n` (a 40-character `=` rule above and below). Nothing else in the file moved.

**Decided:** no emoji and no color codes so it prints the same on Windows. The old one-line wording in the Phase 3 entry above is superseded.

**Tested:** a scratch harness piping JSON into the hook in temp folders: offer on the 3rd failure only, silent on the 4th and 5th; message is 4 lines, ASCII only, one JSON line; fail-open cases (empty and bad stdin, `null`, other tool, other command, no exit-code line, interrupt, missing and broken config, unwritable fails file) all exit 0 with no output; a pass resets and a new run of 3 offers again. 20 of 20 passed. Not tested: how a multi-line `systemMessage` looks in a real Claude Code session.

**What the model got wrong:** nothing; the model is not involved in the hook. My own note: the scratchpad harness the request mentioned did not exist (the folder was empty), so I wrote a new one.

## 2026-10-25: Hook also tells the model to relay the offer

**Asked for:** two changes only in `tools/hook-build.js`: (1) start the `systemMessage` with a newline so the `====` box begins on its own line; (2) also output `hookSpecificOutput` with `hookEventName: "PostToolUseFailure"` and an `additionalContext` asking Claude to tell me, in one short sentence, "Build failed 3 times in a row. Type /stuck for a hint." Offer once and fail open stay the same. Check the hooks docs first, show the diff before saving, run the hook tests, no commit.

**Changed:** `tools/hook-build.js` only: new `CONTEXT` constant; the offer now prints one JSON object `{ systemMessage: "\n" + box, hookSpecificOutput: { hookEventName, additionalContext } }`. The docs (checked by a helper agent) say `additionalContext` is supported for `PostToolUseFailure`, `systemMessage` is a top-level field, and exit 0 with a single JSON object on stdout is the intended form.

**Decided:** the model only relays a line that the code wrote. The sentence it must say is fixed text in `CONTEXT`, and the text also tells it not to fix the code and not to give hints. The hook itself still makes no model call. The hint, if I want one, still only comes from me typing `/stuck`.

**Tested:** a new scratch harness (the old one was gone), 27 of 27 passed: offer on the 3rd failure only, silent on the 4th and 5th; stdout is exactly one JSON line with only `systemMessage` and `hookSpecificOutput`; `systemMessage` starts with `\n` and the box is 4 lines of ASCII; `hookEventName` and `additionalContext` match the text exactly; a pass resets and 3 more failures offer again; a different error restarts the count; fail-open cases (empty and bad stdin, `null`, other tool, other command, no exit-code line, exit 0, interrupt, missing and broken config, unwritable fails file) exit 0 with no output.

**Not tested:** how this looks in a live Claude Code session, and whether the model really says the sentence. The docs have no example that combines `systemMessage` and `hookSpecificOutput` in one object. And since the model only relays, it may word it a little differently or skip it; that would be the model, not my code.

**What the model got wrong:** nothing found yet (not run with the real model).
