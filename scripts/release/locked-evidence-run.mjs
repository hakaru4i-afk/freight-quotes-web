import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fixtureRepair} from './locked-browser-fixtures.mjs';
import {digest, readLock, requireCheck, sha40, validId, web} from './locked-release.mjs';

export const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function checkoutSha(directory, expected, {ancestor = false, cleanPath} = {}) {
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], {encoding: 'utf8'}).trim();
  requireCheck(git('rev-parse', 'HEAD') === expected, 'EVIDENCE_CHECKOUT_MISMATCH');
  if (ancestor) git('merge-base', '--is-ancestor', expected, 'refs/remotes/origin/main');
  if (cleanPath) requireCheck(git('status', '--porcelain', '--untracked-files=all', '--', cleanPath) === '',
    'EVIDENCE_SOURCE_FILES_MODIFIED');
  return expected;
}

export function runReceipt(lock, kind, env = process.env) {
  requireCheck(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === web &&
    env.GITHUB_REF === 'refs/heads/main' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_ACTOR === 'hakaru4i-afk' && env.GITHUB_TRIGGERING_ACTOR === 'hakaru4i-afk' &&
    validId(env.GITHUB_RUN_ID) && validId(env.GITHUB_RUN_ATTEMPT) && sha40.test(env.GITHUB_SHA),
  'PROTECTED_MAIN_EVIDENCE_REQUIRED');
  return {...lock, kind, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, workflowSha: env.GITHUB_SHA};
}


// Do not await the CLI at module scope: locked-qa-package imports checkoutSha from this module.
async function main() {
  const [kind, candidate, reportPath, outputPath] = process.argv.slice(2);
  const lock = readLock();
  const field = {frontend: 'frontendSha', backend: 'backendSha'}[kind];
  requireCheck(field, 'UNKNOWN_REGRESSION_KIND');
  const sourceSha = checkoutSha(candidate, lock[field], {ancestor: kind === 'backend'});
  const report = readFileSync(reportPath);
  const receipt = {...runReceipt(lock, kind), sourceSha, generatedAt: new Date().toISOString(), reportSha256: digest(report)};
  if (kind === 'frontend') receipt.fixtureRepair = fixtureRepair('verify',candidate,sourceSha);
  if (kind === 'backend') {
    const {qaInputSha256} = await import('./locked-qa-package.mjs');
    receipt.qaInputSha256 = qaInputSha256(candidate, lock);
  }
  writeFileSync(outputPath, JSON.stringify(receipt) + '\n', {flag: 'wx'});
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
