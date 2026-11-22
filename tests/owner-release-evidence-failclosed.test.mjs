import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('production evidence gate rejects unproven DB and Storage restoration',()=>{
  const gate=read('scripts/release/owner-portal-verify-evidence.mjs');
  assert.match(gate,/RELEASE_EXACT_SOURCE_PAIR_REQUIRED/);
  assert.match(gate,/RELEASE_BACKEND_CHECKOUT_SHA_MISMATCH/);
  assert.match(gate,/RELEASE_ISOLATED_DB_STORAGE_RESTORE_RECEIPT_REQUIRED/);
  assert.match(gate,/throw Error\('RELEASE_ISOLATED_DB_STORAGE_RESTORE_RECEIPT_REQUIRED'\)/);
});

test('browser E2E is pinned to exact frontend source commit',()=>{
  const gate=read('scripts/release/owner-portal-verify-evidence-frontend.mjs');
  assert.match(gate,/E2E_EXACT_FRONTEND_SHA_REQUIRED/);
  assert.match(gate,/r\.head_sha===expected/);
  assert.match(gate,/E2E_EXACT_FRONTEND_SHA_RUN_MISSING/);
});

test('protected release checks evidence before deployment',()=>{
  const workflow=read('.github/workflows/owner-portal-release.yml');
  const check=workflow.indexOf('node scripts/release/owner-portal-verify-evidence.mjs');
  assert.ok(check>=0,'missing release evidence verification');
  const next=workflow.indexOf('Verify no main branch changed during checks');
  assert.ok(next>check,'evidence must precede final release consistency checks');
});
