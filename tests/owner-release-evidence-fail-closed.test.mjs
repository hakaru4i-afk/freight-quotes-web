import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const workflow = readFileSync('.github/workflows/owner-portal-release.yml', 'utf8');
const verifier = 'scripts/release/owner-portal-verify-evidence.mjs';
test('production jobs depend on protected evidence verifier', () => {
 const verify = workflow.indexOf('name: Require protected E2E and backup evidence before any production deployment');
 const deploy = workflow.indexOf('\n  deploy-api:');
 assert.ok(verify > 0 && verify < deploy);
 assert.match(workflow.slice(verify,deploy), /node scripts\/release\/owner-portal-verify-evidence\.mjs/);
 assert.match(workflow.slice(deploy), /needs: verify/);
 assert.match(workflow.slice(workflow.indexOf('\n  deploy-pages:')), /needs: \[verify,deploy-api\]/);
});
test('missing evidence credentials fails closed', () => {
 const result = spawnSync(process.execPath,[verifier],{encoding:'utf8',env:{PATH:process.env.PATH||'',GITHUB_WEB_TOKEN:'',GITHUB_BACKEND_TOKEN:'',FRONTEND_SHA:'',BACKEND_SHA:''}});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/RELEASE_GITHUB_TOKENS_MISSING/);
});
test('backup-only proof is not isolated DB and Storage restore', () => {
 const source=readFileSync(verifier,'utf8');
 assert.match(source,/RELEASE_ISOLATED_DB_STORAGE_RESTORE_RECEIPT_REQUIRED/);
 assert.doesNotMatch(source,/owner-portal-verify-evidence-frontend\\.mjs|owner-portal-verify-evidence-backend\\.mjs/);
 assert.match(source,/throw Error\\('RELEASE_ISOLATED_DB_STORAGE_RESTORE_RECEIPT_REQUIRED'\\)/);
});

test('malformed release pair is rejected before checkout or network evidence reads', () => {
 for (const [frontend,backend] of [
  ['','a'.repeat(40)],
  ['a'.repeat(40),''],
  ['a'.repeat(39)+'Z','b'.repeat(40)],
  ['a'.repeat(40),'b'.repeat(39)],
 ]) {
  const result=spawnSync(process.execPath,[verifier],{
   encoding:'utf8',
   env:{PATH:process.env.PATH||'',GITHUB_WEB_TOKEN:'synthetic-not-used',GITHUB_BACKEND_TOKEN:'synthetic-not-used',FRONTEND_SHA:frontend,BACKEND_SHA:backend}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/RELEASE_EXACT_SOURCE_PAIR_REQUIRED/);
 }
});

test('synthetic but well-formed wrong frontend SHA is rejected before evidence API calls', () => {
 const result=spawnSync(process.execPath,[verifier],{
  encoding:'utf8',timeout:10000,
  env:{...process.env,GITHUB_WEB_TOKEN:'synthetic-no-network',GITHUB_BACKEND_TOKEN:'synthetic-no-network',FRONTEND_SHA:'0'.repeat(40),BACKEND_SHA:'1'.repeat(40)}
 });
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/RELEASE_FRONTEND_CHECKOUT_SHA_MISMATCH/);
});
