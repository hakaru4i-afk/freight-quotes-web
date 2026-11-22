import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../owner-register-task-actions-20261121.js', import.meta.url), 'utf8');

test('Owner register controls remain disabled after asynchronous actions on locked or busy records', () => {
  assert.match(source, /const locked=Boolean\(/);
  assert.match(source, /const busy=Boolean\(/);
  assert.match(source, /finally\{sending=false;for\(const b of \[start,postpone,reject,apply,acceptButton,rejectButton,reviewButton\]\)if\(b\)b\.disabled=locked\|\|busy/);
  assert.doesNotMatch(source, /finally\{sending=false;[^\n]*b\.disabled=false/);
});
