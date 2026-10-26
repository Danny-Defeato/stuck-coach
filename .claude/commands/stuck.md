---
description: Run my build and give a hint for the error at the next level (or /stuck --duck for questions only)
argument-hint: [--duck [your answer]]
allowed-tools: Bash(node tools/stuck.js:*)
---

The user typed this argument: `$ARGUMENTS`

- If the argument is empty, run `node tools/stuck.js` with the Bash tool.
- If the argument is exactly `--duck` with nothing after it, run `node tools/stuck.js --duck` with the Bash tool.
- If the argument starts with `--duck ` followed by more text, run the command below with the Bash tool. Put the text after `--duck ` verbatim on the line between the two marker lines. Do not quote, escape, shorten or change it in any way.

```
node tools/stuck.js --duck --stdin <<'STUCK_ANSWER_END'
(the text after --duck goes here, exactly as typed)
STUCK_ANSWER_END
```

- For any other argument, run nothing and print exactly: `Usage: /stuck   or   /stuck --duck [your answer]`

Show the script's output exactly as printed, character for character. Add nothing of your own: no extra explanation, no summary, no suggestions, no code. Do not run any other command, read any file, or edit anything.
