// /stuck-mode: show the policy mode, or change it. Only this script writes .stuck-policy.json.
const { MODES, readPolicy, writeMode } = require('./policy');

const say = (text) => console.log(text);
const describe = (mode) => `${mode}: ${MODES[mode].about}`;
const requested = process.argv[2];

if (requested === undefined) {
  const policy = readPolicy();
  if (policy.warning) say(policy.warning);
  say(`Mode is ${describe(policy.mode)}`);
  say(`Change it with: /stuck-mode ${Object.keys(MODES).join(' | ')}`);
} else if (process.argv.length === 3 && Object.prototype.hasOwnProperty.call(MODES, requested)) {
  writeMode(requested);
  say(`Mode is now ${describe(requested)}`);
} else {
  say(`"${process.argv.slice(2).join(' ')}" is not a mode. Use one of: ${Object.keys(MODES).join(', ')}. The mode was not changed.`);
  process.exitCode = 1;
}
