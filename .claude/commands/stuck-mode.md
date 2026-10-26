---
description: Show or change the policy mode (practice, graded or locked)
argument-hint: [practice|graded|locked]
allowed-tools: Bash(node tools/stuck-mode.js:*)
---

The user typed this argument: `$ARGUMENTS`

If the argument is empty, run `node tools/stuck-mode.js` with the Bash tool. If it is exactly one of the words `practice`, `graded` or `locked`, run `node tools/stuck-mode.js` followed by that one word. If it is anything else, run `node tools/stuck-mode.js` with no argument. Never put any other text in the command.

Show the script's output exactly as printed, character for character. Add nothing of your own: no extra explanation, no summary, no suggestions. Do not run any other command, read any file, or edit anything.
