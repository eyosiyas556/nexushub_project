const assert = require('assert');
const { isAccountActive } = require('./accountStatus');

assert.strictEqual(isAccountActive('Active'), true, 'Active accounts may log in');
assert.strictEqual(isAccountActive('active'), true, 'status check is case-insensitive');
assert.strictEqual(isAccountActive(' ACTIVE '), true, 'status is trimmed');
assert.strictEqual(isAccountActive('Inactive'), false, 'Inactive accounts must be blocked');
assert.strictEqual(isAccountActive('inactive'), false, 'lowercase Inactive is blocked');
assert.strictEqual(isAccountActive('Suspended'), false, 'non-active statuses are blocked');
assert.strictEqual(isAccountActive(null), true, 'legacy null status stays usable');
assert.strictEqual(isAccountActive(''), true, 'legacy blank status stays usable');

console.log('accountStatus tests passed');
