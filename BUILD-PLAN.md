# Build plan

Each phase: paste the prompt into Claude Code (start in plan mode), read the plan, let it build,
run the checklist yourself, then commit. If a phase breaks something that worked,
`git restore <file>` takes you back to the last commit.

**Schedule (due Sunday Oct 25, 11:59 PM)**

| Day | Do |
|---|---|
| Mon | Phase 0, start Phase 1 |
| Tue | Finish Phase 1, Phase 2 |
| Wed | Phase 3 (hook) |
| Thu | Phase 4 (/fixed) |
| Fri | Phase 5 (duck mode), tidy LOG.md |
| Sat | Phase 7: portfolio card, push, spare time |
| Sun | Submit on Canvas. Not a build day. |

**Cut rule:** if Thursday night you're behind, stop adding phases and finish. Write in LOG.md which
phases you dropped and why. That counts as a decision. Phases 1 and 2 alone are a complete artifact.

---

## Phase 0: Set up

1. Check your tools in a terminal: `node --version` and `javac -version` (both should print a version).
   If `node` is missing, install the LTS version from nodejs.org, then open a new terminal.
2. On GitHub, create a new **public** repository named `stuck-coach` with a README.
3. Clone it and go in: `git clone https://github.com/Danny-Defeato/stuck-coach.git` then `cd stuck-coach`
4. Copy everything from this kit into the folder, including the hidden files `.gitignore` and
   `.stuck-config.json` (turn on "Hidden items" in File Explorer to see them) and the `examples` folder.
5. `git add .` then `git commit -m "Add project plan, CLAUDE.md, log and practice files"` then `git push`
6. Run `claude` inside the folder. Stay in Manual permission mode and read every command before approving.
7. Run `/init`, accept the suggestions you agree with, then `git commit -am "Update CLAUDE.md from /init"`.

---

## Phase 1: Core /stuck

Plan mode first.

**Prompt:**
> Read CLAUDE.md. Build phase 1, the core /stuck command. Create tools/stuck.js and .claude/commands/stuck.md.
> The script reads the build command from .stuck-config.json, runs it itself, and captures stdout, stderr
> and the exit code. If the build passes, print "Build passed" and reset the level. If it fails, make an
> errorKey from the first error line (without line numbers), compare it to .stuck-level: same key means
> level + 1 (max 3), a different key means start at level 1. Then call `claude -p` with the real error,
> about 10 lines of source around the error line, and the level (1 = a nudge that doesn't reveal the cause,
> 2 = explain the cause without code, 3 = the specific fix with at most 3 lines of code). Ask for a short
> plain-words explanation plus the hint. The script must check the reply has no more than 3 lines of code
> (and none at levels 1 and 2), retry ONCE telling the model exactly what was wrong, then print the reply
> with a one-line status from the script (level, code-line count). Add STUCK_FAKE_REPLY support from
> CLAUDE.md. First tell me in plain words which part the model does and which part the script does, put
> that split in README.md, then build. Tell me how to test it and add an entry to LOG.md.

**Check it yourself** (use `examples/`; change the command in `.stuck-config.json` to try each file):
- [ ] `STUCK_FAKE_REPLY` with a 12-line code block at level 1: the script rejects it and retries (with the fake it will fail twice and print a clear message).
- [ ] `TypeMismatch.java`: /stuck three times: levels 1, 2, 3, getting more specific. The fourth says that was the last level.
- [ ] Switch to `MissingReturn.java`: the level restarts at 1 because the error changed.
- [ ] `Clean.java`: "Build passed", level reset.
- [ ] `NullPointer.java` needs a command that also runs the program (`javac -d out examples/NullPointer.java && java -cp out NullPointer`). Does it catch the runtime error?
- [ ] A broken build command (typo): a clear message, not a crash.
- [ ] Look at the model's real reply: did it follow the level? Write one thing it got wrong in LOG.md.

**Commit:** `git add .` then `git commit -m "Add core /stuck command"`

---

## Phase 2: Policy modes

**Prompt:**
> Read CLAUDE.md. Build phase 2, policy modes. Read .stuck-policy.json ({"mode": "practice" | "graded" |
> "locked"}, default practice). practice allows levels 1 to 3, graded stops at level 2, locked never gives
> a fix hint: only the plain-words explanation of the error and a note that the mode is locked. The script
> enforces this itself before calling the model: when the cap is reached it prints a message and does NOT
> call the model at all. Add a /stuck-mode command (or an argument) that shows or changes the mode. Tell me
> how to test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] graded: the third /stuck says hints stop at level 2, and no `claude -p` call was made (check that the reply came back instantly).
- [ ] locked: explanation only, no "try this" advice.
- [ ] A broken `.stuck-policy.json` (bad JSON, unknown mode): falls back to the safest mode (locked) and says so.
- [ ] practice still works as in phase 1.

**Commit:** `git commit -am "Add policy modes"`

---

## Phase 3: Auto-offer hook

**Prompt:**
> Read CLAUDE.md. Build phase 3, the auto-offer hook. Add a Claude Code hook in .claude/settings.json that
> runs `node tools/hook-build.js` after my build command runs. The hook script stores the error key and a
> consecutive-failure count in .stuck-fails.json. When the same error has failed 3 times in a row, print
> "Build failed 3 times in a row. Type /stuck for a hint." Reset the count when the build passes or the error
> changes. No model call in the hook. Explain in plain words how a hook differs from an instruction in
> CLAUDE.md. Tell me how to test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] Three failures of the same error: the offer appears on the third, not before.
- [ ] A different error in between resets the count.
- [ ] A passing build resets it.
- [ ] Windows: the hook runs (it uses `node`, not bash).

**Commit:** `git commit -am "Add auto-offer hook"`

---

## Phase 4: /fixed

**Prompt:**
> Read CLAUDE.md. Build phase 4, /fixed. The script gets `git diff` for my uncommitted changes and the last
> error saved by /stuck, then asks me in one line what was wrong, in my own words. Code checks my sentence
> shares at least one word of 4+ letters with the error text or the diff. Then call `claude -p` with the
> diff, the error and my sentence and ask for JSON {"matches": true or false, "feedback": "one sentence"}.
> Validate the JSON in code (retry once if it's not valid). If matches is true, append the date, the error
> and MY sentence to LEARNED.md. If false, show the feedback and let me try once more. Never write the
> model's words into LEARNED.md. Add STUCK_FAKE_REPLY support. Tell me how to test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] A good sentence is saved, a lazy one ("I fixed it") is refused by the code before the model is called.
- [ ] A fake reply of invalid JSON is rejected and retried.
- [ ] LEARNED.md only contains your sentences.

**Commit:** `git commit -am "Add /fixed"`

---

## Phase 5: Duck mode

**Prompt:**
> Read CLAUDE.md. Build phase 5, duck mode: `/stuck --duck`. The model never gives hints or code: it asks
> one short question at a time about the real error, building on my previous answer. Keep the conversation
> in a temp file. Code checks every reply ends with a question mark and contains no code lines (retry once),
> and after 6 questions says to try plain /stuck. Respect the policy mode (locked mode: duck mode is allowed,
> since it gives no answers). Add fake-reply support. Tell me how to test it and add an entry to LOG.md.

**Check it yourself:**
- [ ] A fake reply with code in it is rejected. A reply without a question mark is rejected.
- [ ] After 6 questions it stops.
- [ ] Questions really build on your last answer (read the real model's replies).

**Commit:** `git commit -am "Add duck mode"`

---

## Phase 6 (stretch, after the deadline): Stuck Stats

Only if everything else is done and committed. Ask Claude Code to log each /stuck to `stuck-log.json`
(date, category from a FIXED list, highest level used, minutes to fix) and generate a `stats.html`.
Code must reject any category not on the list and check every number in the model's summary sentence.

---

## Phase 7: README, portfolio card, submit

1. Ask Claude Code to bring `README.md` and `LOG.md` up to date (what the model does, what the code checks, how to run it, what you dropped). Read it over.
2. Make sure `README.md` has a **short demo**: a screenshot or a pasted terminal session of /stuck climbing the levels.
3. Commit and push.
4. Portfolio card for Artifact 3 (your portfolio's `content.js`):
   - `title`: Hint Coach (or your own name for it)
   - `status`: `"done"`
   - `link`: the repository link
   - `reflection`: a few sentences **in your own words**: what the model does, what your code checks, one thing the model got wrong and how your code or you caught it.
5. Push the portfolio and submit your portfolio link on Canvas (same link as before).

**Out of time?** The artifact is complete if it runs, the repository has a log, and the card is on your portfolio.
