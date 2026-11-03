import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../test/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../test/index.html', import.meta.url), 'utf8');
const info = JSON.parse(readFileSync(new URL('../test/build-info.json', import.meta.url), 'utf8'));
const state = JSON.parse(readFileSync(new URL('../test/site-status.json', import.meta.url), 'utf8'));
test('Issue49 production is not modified by staging build', () => {
  assert.equal(info.environment, 'staging');
  assert.equal(info.projectRef, 'ibclzdkxiozbzmniiygv');
  assert.ok(state.stagingVerification.ownerAcceptance === 'PENDING');
  assert.equal(state.stagingVerification.production, 'NOT UPDATED');
  assert.ok(html.includes('./app.js?v=67fdfec266aa'));
});
test('bounded session request and cleanup are present', () => {
  const idx=app.indexOf('function ny()'),end=app.indexOf('var ry=',idx);
  assert.ok(idx>0&&end>idx);
  const s=app.slice(idx,end);
  assert.match(s,/fetch\("\/api\/session",\{signal:/);
  assert.match(s,/new AbortController/);
  assert.match(s,/45e3/);
  assert.match(s,/\.abort\(\)/);
  assert.match(s,/\.finally/);
});
test('access polling is non-overlapping, preserves 403 and avoids rerendering unchanged role', () => {
  const idx=app.indexOf('function Dy({children:i})'),end=app.indexOf('function bf()',idx);
  assert.ok(idx>0&&end>idx);
  const s=app.slice(idx,end);
  assert.match(s,/u\|\|document.hidden/);
  assert.match(s,/fetch\("\/api\/access",\{signal:/);
  assert.match(s,/status===403/);
  assert.match(s,/window.freightAccess=null/);
  assert.match(s,/T!==N/);
  assert.match(s,/clearInterval/);
  assert.match(s,/\.abort\(\)/);
});
