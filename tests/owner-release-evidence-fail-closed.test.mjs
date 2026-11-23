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
 assert.match(source,/owner-portal-verify-evidence-frontend\.mjs/);
 assert.match(source,/owner-portal-verify-evidence-backend\.mjs/);
});
