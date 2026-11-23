import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

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


test('release verifier fails before network calls when source pair is missing',()=>{
  const script=new URL('../scripts/release/owner-portal-verify-evidence.mjs',import.meta.url);
  const result=spawnSync(process.execPath,[script.pathname],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,GITHUB_WEB_TOKEN:'synthetic-no-network',GITHUB_BACKEND_TOKEN:'synthetic-no-network',FRONTEND_SHA:'invalid',BACKEND_SHA:'invalid'}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/RELEASE_EXACT_SOURCE_PAIR_REQUIRED/);
});

test('browser verifier rejects missing exact SHA before GitHub API access',()=>{
  const script=new URL('../scripts/release/owner-portal-verify-evidence-frontend.mjs',import.meta.url);
  const result=spawnSync(process.execPath,[script.pathname],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,GITHUB_WEB_TOKEN:'synthetic-no-network',FRONTEND_SHA:'invalid'}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/E2E_EXACT_FRONTEND_SHA_REQUIRED/);
});
