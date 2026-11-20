import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {selectQuickChecks} from '../scripts/quick-ci.mjs';

test('documentation and release audit edits do not require all feature suites', () => {
  const plan = selectQuickChecks('frontend', ['docs/qa/release-notes.md', 'scripts/release-evidence.mjs']);
  assert.deepEqual(plan.groups, ['release']);
  assert.equal(plan.fullAcceptance, false);
});

test('maps select the same domain on both repos and SQL requires recovery', () => {
  const web = selectQuickChecks('frontend',['test/global-view/view.mjs']);
  const api = selectQuickChecks('backend',['src/transport-application/shipment-geopoints.mjs']);
  for (const plan of [web,api]) {
    assert.ok(plan.groups.includes('execution'));
    assert.equal(plan.fullAcceptance,true);
  }
  const migration = selectQuickChecks('backend',['supabase/migrations/change.sql']);
  assert.equal(migration.recovery,true);
  assert.equal(migration.fullAcceptance,true);
});

test('a shared API entry, including unseen code paths, selects all risk groups', () => {
  assert.deepEqual(selectQuickChecks('backend',['src/transport-application/index.ts']).groups,
    ['execution','orders','release','roles']);
});
