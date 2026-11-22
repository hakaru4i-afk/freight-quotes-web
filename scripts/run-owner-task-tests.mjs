import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// These suites exercise already-published Pages or its real API. Their
// existing assertions run independently of the unpublished source check.
const published = new Set([
  'issue28-served-staging.test.mjs',
  'issue47-live-mobile.test.mjs',
  'issue47-live-served.test.mjs',
  'issue47-served-pages.test.mjs',
  'lw-partner-proposal-files.test.mjs',
  'lw-public-guide-live.test.mjs',
  'owner-command-center-browser.test.mjs',
  'owner-registers-browser.test.mjs',
  'owner-workspace-compact-browser.test.mjs',
  'public-entry-browser.test.mjs',
  'qa-anonymous-roles.test.mjs',
  'qa-public-served.test.mjs',
  'role-help-browser.test.mjs',
  'task12-observer-smoke.test.mjs',
  'task12-real-api-security-negative.test.mjs'
]);
const mixed = 'lw-hover-safe-browser.test.mjs';
const suite = process.argv[2];
if (!['source', 'published'].includes(suite)) throw Error('Expected a source or published suite');
const all = readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort();
for (const name of [...published, mixed]) {
  if (!all.includes(name)) throw Error('Test suite entry is missing: '+name);
}
const files = all.filter(name => suite === 'source' ? !published.has(name) : published.has(name) || name === mixed);
console.log('Owner task '+suite+' suite: '+files.length+' files');
const result = spawnSync(process.execPath, [
  '--test', '--test-concurrency=2', ...files.map(file => 'tests/'+file)
], {stdio:'inherit', env:{...process.env, FREIGHT_OWNER_TEST_SUITE:suite}});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
