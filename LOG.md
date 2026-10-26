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
