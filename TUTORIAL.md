# Tutorial: your first hint

This tutorial is for someone who has never seen Hint Coach (`stuck-coach`). It takes about 20 minutes. Commands are for Windows PowerShell first. Anything I could not run myself is marked **untested**.

Hint Coach helps when your Java code won't build or run. It runs your build, shows you the real error, explains it in plain words, and gives a hint that gets a little more specific each time you ask. It is built so you learn from the error, not just get the fix.

## Before you start

You need three things. Run each check in PowerShell. Each should print a version number.

| You need | Check | If it fails |
|---|---|---|
| Node.js | `node --version` | Install Node.js from nodejs.org, then open a new PowerShell window. |
| Java JDK (the compiler, not only the runtime) | `javac -version` | Install a JDK. `java -version` alone is not enough: the build uses `javac`. |
| Claude Code, logged in | `claude --version` | Install Claude Code, then run `claude` once and sign in. |

`claude --version` only proves it is installed. To check you are logged in, run `claude -p "say hi"`. It makes one tiny model call and uses a little of your usage. (I did not run this check myself: **untested**.)

You also need `git` to clone the project.

## Set it up

1. Clone the project and go into the folder. Clone it from GitHub:

   ```powershell
   git clone https://github.com/Danny-Defeato/stuck-coach
   cd stuck-coach
   ```

2. Start Claude Code **inside this folder**. The `/stuck` commands live in the folder's `.claude` directory, so they only exist when you start Claude Code here.

   ```powershell
   claude
   ```

3. Look at `.stuck-config.json`. It tells Hint Coach how to build your code:

   ```json
   { "command": "javac -d out examples/TypeMismatch.java" }
   ```

   - `command` is the exact line you would type in a terminal to build your program. Hint Coach runs it for you every time. It runs only this command, never anything the model suggests.
   - `javac` is the Java compiler. `-d out` puts the compiled files in a folder called `out`.
   - `examples/TypeMismatch.java` is **where the source file path goes**: the path to your `.java` file, written from the project folder. Use forward slashes (`/`) so you don't have to double backslashes in JSON.
   - Hint Coach only reads source files inside this folder.

   To use your own file, change that path, for example `javac -d out src/MyProgram.java`.

   If your program compiles but crashes when it runs, build and run it in one command, like the `NullPointer.java` practice file:

   ```json
   { "command": "javac -d out examples/NullPointer.java && java -cp out NullPointer" }
   ```

The folder already has a `.stuck-config.json` pointing at `examples/TypeMismatch.java`, so you can skip editing for the next section.

## Your first hint

`examples/TypeMismatch.java` has a compile error **on purpose** (a method says it returns a `String` but returns an `int`). You don't need to break anything.

In Claude Code, type:

```
/stuck
```

Or in a plain PowerShell window in the same folder:

```powershell
node tools/stuck.js
```

You get something like this (the model's wording will be different every time):

```
The compiler is telling you that on line 13, you gave it a whole number (an `int`), but the spot where that value goes expects text (a `String`). It points at the call to `findIndex(name)` as the place where the number comes from.

Nudge: Compare the type that `findIndex` hands back with the type that `lookup` on line 12 promises to return.

[stuck] level 1 of 3 | mode: practice | code lines: 0 | error: incompatible types: int cannot be converted to String
```

How to read it:

- **The first paragraph** explains what the real error means. The error comes from the real build output, not from the model's guess.
- **The nudge or hint** is the part that gets more specific each time.
- **The footer line** is printed by the script, not the model:
  - `level 1 of 3`: you are on hint level 1. The second number is the most hints your mode allows (3 in practice mode).
  - `mode: practice`: the current policy mode (see "Modes").
  - `code lines: 0`: how many lines of code the reply contained. It is 0 at levels 1 and 2 and at most 3 at level 3. The script checks this.
  - `error: ...`: the short name Hint Coach gave this error. As long as the error keeps this name, it counts as the same error. Line numbers are left out, so the same mistake on a different line is still the same error.

Now fix the bug in `examples/TypeMismatch.java` yourself (or don't, to keep reading), and run `/stuck` again. When the build passes you will see `Build passed`.

## How the hints grow

Each time you run `/stuck` and the **same error** is still there, you get the next level:

| Level | What you get | Code in the reply |
|---|---|---|
| 1, a nudge | What the error message literally says, plus one nudge about where to look. It should not say what is wrong or why. | None |
| 2, the cause | What the error means and why it happens in your code. It should not show the fix. | None |
| 3, the fix | The error explained, then the specific fix. | At most 3 lines |

Code checks every reply. If a reply has too much code, the script tells the model exactly what was wrong and tries once more. If that fails too, it stops with a clear message. A failed call does not use up a hint level, because the level is saved only after a good reply.

**"Last level."** After you have used your top level for an error (3 in practice, 2 in graded), the next `/stuck` prints this and does **not** call the model:

```
Mode is practice: hints stop at level 3, and you have used them for this error. No more hints. Change the code or ask your instructor.
```

That is the limit working, not a bug.

**When the error changes.** The level is tied to the error:

- You fix the error and the build passes: `Build passed`, and the level resets.
- You fix it and hit a **different** error: you start at level 1 for the new one.
- The error is still the same: you get the next level.

## Modes

A mode is a cap on how much help you can get. It exists so you can stay inside your course's AI rules. Show it or change it:

```
/stuck-mode
/stuck-mode graded
```

Or in a terminal: `node tools/stuck-mode.js graded`.

| Mode | What it allows |
|---|---|
| `practice` | Hints up to level 3 (the fix). This is the default if there is no policy file. |
| `graded` | Hints stop at level 2. You never get the fix. |
| `locked` | Explanation only, no hints. The footer shows `mode: locked | explanation only` and no level. |

Locked still calls the model once, because only the model can write the explanation. Your hint level is not changed while you are in locked mode.

**Please read this plainly:** the mode lives in a file on your own computer (`.stuck-policy.json`), and you can change it yourself with `/stuck-mode` or by editing the file. It is a **nudge, not security**. It helps you keep your own promise; it cannot stop you. Check your course's AI policy before using `/stuck` on graded work. If the file is broken or names an unknown mode, Hint Coach falls back to `locked` and tells you.

## Reflect with /fixed

After you fix a bug, write down what it was. This is the part that makes it stick.

1. First run `/stuck` on the failing build, so it saves the error. (If you have already done that, you are set.)
2. Fix the bug in your `.java` file.
3. In a PowerShell window in the project folder, run:

   ```powershell
   node tools/fixed.js
   ```

   It is terminal-only because it needs you to type a line.

4. It asks: `In one line, in your own words: what was wrong?` Type one sentence.

A good sentence says what was actually wrong, using words from the error or from the lines you changed:

```
lookup returned an int but needed a String so I used String.valueOf on findIndex
```

A bad sentence is `I fixed it`. **The code refuses vague sentences before it asks the model anything.** A sentence is refused if it has fewer than 4 words, or if it shares no word of 4 letters or more with the error message or the lines you changed. Common words like "error", "wrong" and "fixed" don't count. After 3 refusals it stops and you run it again.

If your sentence passes, the model gets only one job: say whether your sentence matches the error and your change, with one sentence of feedback. You see the feedback. If it says it doesn't match, you get one more try.

**What gets saved:** when it matches, the script adds the date, the error and **your sentence** to `LEARNED.md`. Nothing the model wrote is saved. `LEARNED.md` is personal and is in `.gitignore`, so it isn't committed.

`/fixed` looks at `git diff HEAD -- "*.java"`, so it needs the folder to be a git repo, and brand-new files that git doesn't track yet are not included.

## Duck mode

Sometimes you don't want a hint. You want to think it through. Duck mode is like talking to a rubber duck that only asks questions.

```
/stuck --duck
```

It prints one question about your real error. Answer it with:

```
/stuck --duck <your answer>
```

For example: `/stuck --duck I think lookup returns the wrong thing`. Each run asks **one** question. You can go up to **6 questions**; then it tells you to try plain `/stuck`.

How it differs from hints:

- It never gives hints or code, only questions. Code checks that the reply is only questions, with no code, and at most 3 questions.
- It never changes your hint level.
- Every mode allows it, including `locked`.
- It remembers your earlier answers in a temp file outside the project. The conversation starts over if the error changes, and is deleted when the build passes.
- If you run `/stuck --duck` again without answering, it shows the same question again.

**PowerShell apostrophe warning.** In a plain PowerShell terminal, type your answer in **double quotes**:

```powershell
node tools/stuck.js --duck "I don't know what findIndex returns"
```

If you use single quotes, an apostrophe inside the answer ends the string early and PowerShell gives an error (`The string is missing the terminator`). In single quotes, write the apostrophe twice: `'I don''t know'`. Also, PowerShell treats `$` in double quotes as a variable, so write `` `$ `` if your answer needs a dollar sign. Answers are one line and are cut at 300 characters.

Inside Claude Code, `/stuck --duck <your answer>` sends your text to the script through a quoted heredoc so quotes and symbols can't run anything. This was checked both ways: the script side with fake replies, and the Claude Code layer in a live session, apostrophes included.

## The auto-offer

If the same build error keeps coming back, Hint Coach offers help on its own.

- It is a hook: a small command that Claude Code itself runs after your build command, every time.
- It counts failures of **the same error in a row**. On the **3rd** one it shows a box and Claude tells you to type `/stuck`:

  ```
  ========================================
  STUCK? The build failed 3 times in a row.
  Type /stuck for a hint.
  ========================================
  ```

- It shows **once** per error. A different error or a passing build resets the count.
- It only sees builds that **Claude Code runs** for you (through its Bash or PowerShell tool), and only the exact command in `.stuck-config.json`. It does not see builds you run in your own terminal, or the build `/stuck` runs inside its script.
- The hook itself is plain code and makes no model call. The box comes from the code. Claude only repeats a sentence the code gave it, so it may reword it or skip it.

**Turn it off:** in `.claude/settings.json`, delete the two `hooks` entries (`PostToolUseFailure` and `PostToolUse`), or add `"disableAllHooks": true`.

## If something goes wrong

| Problem | Fix |
|---|---|
| You typed `! Remove-Item .stuck-level` in Claude Code and got an error. | The `!` prefix in Claude Code runs **Git Bash**, not PowerShell. Use `! rm -f .stuck-level`. In a normal PowerShell window, `Remove-Item .stuck-level` is right. |
| You ran `git add .` and it staged far too much, or the wrong files. | `git add .` adds everything under the folder you are in. Check where you are and what is staged first: `pwd` (or `Get-Location`) and `git status`. Move into the `stuck-coach` folder before you add. To unstage everything: `git restore --staged .` |
| `The build command could not start (exit code N). Check for a typo in .stuck-config.json:` and your command. | The command name itself is wrong, for example `javacc` instead of `javac`. Fix the command in `.stuck-config.json`. (A wrong *file path* is different: `javac` runs and says it can't find the file, and `/stuck` explains that as a normal error, which uses up a hint level.) |
| `No more hints. Change the code or ask your instructor.` | The cap did its job. In your mode, you have used the top level for this error. Change the code, try `/stuck --duck` for questions, or ask your instructor. |
| The hints skip ahead, or you want to start over. | A stale `.stuck-level` is remembering an old error. Delete it: PowerShell `Remove-Item .stuck-level`, or in Claude Code `! rm -f .stuck-level`. The next `/stuck` starts at level 1. |
| `/stuck` says it isn't a command. | Start `claude` from inside the `stuck-coach` folder. |
| `The build command did not finish in 60 seconds, so I stopped it. Is the program waiting for input?` | Your program is waiting for typing. The build command should run without asking for input. |
| `/fixed` says `No saved error to compare with.` | Run `/stuck` on a failing build first, then fix it, then run `node tools/fixed.js`. |
| The model didn't answer, or its reply broke a rule twice. | The script prints a clear message and stops. Run `/stuck` again. A failed call doesn't use up a hint level. |

## What it can't do

- **Java only for now.** The error finder reads Java build output. Other languages are untested.
- **The model can still word a hint badly.** Code limits how much code the reply can have, but it can't prove a hint or question avoids leaking the answer. In real runs a level 1 nudge sometimes leaned toward revealing the cause. If a hint says too much, that was the model.
- **Modes are a nudge, not security** (see "Modes").
- **The auto-offer only sees builds Claude Code runs.**
- **`/fixed` ignores brand-new files** git doesn't track yet.

For the rules and how everything was tested, see `README.md`, `CLAUDE.md` and `LOG.md`.
