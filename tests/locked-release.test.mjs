import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {approval, backend, backupWorkflow, digest, evidenceWorkflows, nextVersion, project, qaFunction, qaProject, readLock, stagingUrl, targetFunction, validateLock, verifyBackup, verifyCandidateEvidence, verifyE2eReceipt, verifyEvidenceRun, verifyRegressionReceipt, waitingForBackupGuest, web} from '../scripts/release/locked-release.mjs';
import {compileE2e} from '../scripts/release/locked-e2e-evidence.mjs';
import {verifyDownloadedPackage} from '../scripts/release/locked-qa-runtime.mjs';
import {verifyApiEvidence} from '../scripts/release/locked-release-api.mjs';
import {assertPreservesEntrypoints, bindPages, validateApiProof} from '../scripts/release/locked-release-pages.mjs';

const lock = {frontendSha: 'a'.repeat(40), backendSha: 'b'.repeat(40)};
const bundle = 'c'.repeat(64);
const current = 'SH-01.30.99 v';
const version = 'SH-01.31.00 v';
const apiFunction = targetFunction(lock);
const api = {...lock, apiFunction, releaseVersion: version, apiVersion: 3, apiBundleSha256: bundle};

test('release lock contains exactly two immutable commit SHAs', () => {
  assert.match(readLock().frontendSha, /^[a-f0-9]{40}$/);
  assert.deepEqual(validateLock(lock), lock);
  assert.throws(() => validateLock({...lock, version}), /INVALID_TWO_SHA/);
  assert.throws(() => validateLock({frontendSha: 'main', backendSha: lock.backendSha}), /INVALID_TWO_SHA/);
  assert.equal(nextVersion(current), version);
  assert.match(approval(lock), /^APPROVE FRONTEND=[a-f0-9]{40} BACKEND=[a-f0-9]{40}$/);
});

test('only an exact successful protected backup with real restore allows deployment', () => {
  const run = {id: 51, repository: {full_name: backend}, path: '.github/workflows/' + backupWorkflow,
    head_branch: 'main', event: 'workflow_dispatch', status: 'completed', conclusion: 'success',
    actor: {login: 'hakaru4i-afk'}, display_title: 'Production backup 100'};
  const jobs = {total_count: 1, jobs: [{name: 'capture-and-readback', status: 'completed', conclusion: 'success', labels: ['ubuntu-latest']}]};
  const proof = {result: 'PASS_CAPTURE_PAYLOAD_RESTORE_AND_CIPHERTEXT_READBACK', encrypted: true,
    offsiteReadback: true, ciphertextSha256: bundle, proof: {
      ciphertextSha256: bundle, databaseRestored: true, storageBytesRestored: true, isolationVerified: true,
      sourceCredentialsForwarded: false, ciphertextDecryptionVerified: true, verificationRecipientDestroyed: true
    }};
  const target = {id: 51, parent: '100'};
  assert.doesNotThrow(() => verifyBackup(run, jobs, proof, target));
  assert.throws(() => verifyBackup(run, jobs, proof, {...target, parent: '99'}), /BACKUP_PARENT/);
  assert.throws(() => verifyBackup({...run, conclusion: 'failure'}, jobs, proof, target), /RELEASE_PROOF_RUN/);
  assert.throws(() => verifyBackup(run, jobs, {...proof, offsiteReadback: false}, target), /BACKUP_OR_RESTORE_PROOF/);
  assert.throws(() => verifyBackup(run, jobs, {...proof, proof: {...proof.proof, storageBytesRestored: false}}, target), /BACKUP_OR_RESTORE_PROOF/);
});

test('hosted fallback is allowed only while the dedicated guest is unassigned and no capture has started', () => {
  const readiness = {name: 'protected-readiness', status: 'queued', runner_name: ''};
  assert.equal(waitingForBackupGuest({total_count: 1, jobs: [readiness]}), true);
  assert.equal(waitingForBackupGuest({total_count: 1, jobs: [{...readiness, runner_name: 'backup'}]}), false);
  assert.equal(waitingForBackupGuest({total_count: 2, jobs: [readiness, {name: 'capture-and-readback', status: 'in_progress', runner_name: 'backup'}]}), false);
  assert.equal(waitingForBackupGuest({total_count: 1, jobs: [{...readiness, name: 'capture-and-readback'}]}), true);
});

test('validates 37 authenticated scenarios for the exact reviewed pair', () => {
  const reports = {
    pair: {...lock, servedFrontendSha: lock.frontendSha, apiBundleSha256: bundle, servedApiVerified: true},
    regression: {commit: lock.frontendSha, checks: {FAIL: 0, BLOCKED: 0}, scenarios: [11, 26].flatMap((count, j) =>
      Array.from({length: count}, (_, i) => ({id: 'T' + (j + 1) + '-' + String(i + 1).padStart(2, '0'), status: 'PARTIAL'})))},
    security: {status: 'PASS', checks: ['private_tables_and_RLS', 'mutation_rolls_back_rows_and_schema'].map(id => ({id, status: 'PASS'}))},
    e2e: {...lock, environment: 'isolated-qa', authorized: true, criticalDefects: [], scenarios: [11, 26].flatMap((count, j) =>
      Array.from({length: count}, (_, i) => ({
        id: 'T' + (j + 1) + '-' + String(i + 1).padStart(2, '0'), status: 'PASS', mode: 'AUTHENTICATED_QA_API',
        actorRole: 'test-fixture', evidence: {method: 'HTTP_AND_BROWSER', responseVerified: true, traceId: 'test-fixture'}
      })))}
  };
  assert.doesNotThrow(() => verifyCandidateEvidence(lock, reports));
  assert.throws(() => verifyCandidateEvidence(lock, {...reports, pair: {...reports.pair, backendSha: 'd'.repeat(40)}}), /TESTED_RUNTIME_PAIR/);
  reports.e2e.scenarios.pop();
  assert.throws(() => verifyCandidateEvidence(lock, reports), /AUTHENTICATED_37_SCENARIOS/);
});

const now = Date.parse('2026-11-24T12:00:00Z');
const secondsAgo = seconds => new Date(now - seconds * 1000).toISOString();

function actionsFixture(kind) {
  const workflow = evidenceWorkflows[kind];
  const run = {
    id: 196, run_attempt: 2, event: 'workflow_dispatch',
    repository: {full_name: web}, head_repository: {full_name: web},
    path: '.github/workflows/' + workflow.path, head_branch: 'main', head_sha: 'd'.repeat(40),
    actor: {login: 'hakaru4i-afk'}, triggering_actor: {login: 'hakaru4i-afk'},
    status: 'completed', conclusion: 'success', run_started_at: secondsAgo(120), updated_at: secondsAgo(10)
  };
  const jobs = workflow.jobs.map(name => ({name, run_attempt: 2, status: 'completed', conclusion: 'success'}));
  const artifacts = [{id: 17, name: workflow.artifact + '-attempt-2',
    created_at: secondsAgo(12), expired: false, expires_at: secondsAgo(-60)}];
  const receipt = {...lock, kind, runId: '196', attempt: '2', workflowSha: run.head_sha, generatedAt: secondsAgo(13)};
  return {run, jobs: {total_count: jobs.length, jobs}, artifacts: {total_count: artifacts.length, artifacts}, receipt};
}

test('dispatch SHA and exact candidate SHA have separate verified identities', () => {
  const {run, jobs, artifacts, receipt} = actionsFixture('frontend');
  const checkRun = (runData = run, jobData = jobs, artifactData = artifacts) =>
    verifyEvidenceRun('frontend', runData, jobData, artifactData, run.id, now);
  assert.notEqual(run.head_sha, lock.frontendSha);
  assert.equal(checkRun(), 'locked-frontend-regression-attempt-2');
  assert.throws(() => checkRun({...run, path: '.github/workflows/sh59-protected-37-audit.yml'}), /RELEASE_PROOF_RUN_MISMATCH/);
  assert.throws(() => checkRun({...run, event: 'pull_request'}), /RELEASE_PROOF_RUN_MISMATCH/);
  assert.throws(() => checkRun({...run, triggering_actor: {login: 'other'}}), /UNTRUSTED_RELEASE_PROOF_RUN/);
  assert.throws(() => checkRun({...run, run_started_at: secondsAgo(86401)}), /RELEASE_EVIDENCE_TIME_MISMATCH/);
  assert.throws(() => checkRun(run, {...jobs, jobs: jobs.jobs.map(job => ({...job, run_attempt: 1}))}), /REQUIRED_RELEASE_JOB_NOT_PASSED/);
  assert.throws(() => checkRun(run, jobs, {total_count: 0, artifacts: []}), /RELEASE_PROOF_ARTIFACT_MISSING_OR_EXPIRED/);
  assert.throws(() => checkRun(run, jobs, {...artifacts, artifacts: [{...artifacts.artifacts[0], expires_at: secondsAgo(1)}]}),
    /RELEASE_PROOF_ARTIFACT_MISSING_OR_EXPIRED/);
  const bytes = Buffer.from('fresh report');
  const proof = {...receipt, sourceSha: lock.frontendSha, reportSha256: digest(bytes)};
  assert.doesNotThrow(() => verifyRegressionReceipt(lock, 'frontend', proof, run, bytes));
  assert.throws(() => verifyRegressionReceipt(lock, 'frontend', {...proof, sourceSha: run.head_sha}, run, bytes),
    /REGRESSION_SOURCE_OR_REPORT_MISMATCH/);
  assert.throws(() => verifyRegressionReceipt(lock, 'frontend', {...proof, attempt: '1'}, run, bytes), /RELEASE_RUN_RECEIPT_MISMATCH/);
  assert.throws(() => verifyRegressionReceipt(lock, 'frontend', proof, run, 'old report'), /REGRESSION_SOURCE_OR_REPORT_MISMATCH/);
});

test('E2E report and runtime must match the attested run and API regression package', () => {
  const {run, receipt} = actionsFixture('e2e');
  const sources = [{file: 'isolated-rc/browser-results-owner-create.json', sha256: bundle}];
  const e2e = JSON.stringify({...receipt, scenarios: [{evidence: {sources, traceId: digest(JSON.stringify(sources))}}]});
  const backendReceipt = {qaEntrySha256: bundle};
  const pair = {...receipt, stagingUrl, qaProject, apiFunction: qaFunction, apiVersion: 9, qaEntrySha256: bundle,
    servedIndexSha256: bundle, servedAppSha256: bundle, e2eReportSha256: digest(e2e)};
  assert.doesNotThrow(() => verifyE2eReceipt(lock, pair, e2e, run, backendReceipt));
  assert.throws(() => verifyE2eReceipt(lock, {...pair, stagingUrl: 'https://other.test/'}, e2e, run, backendReceipt),
    /E2E_RUNTIME_RECEIPT_MISMATCH/);
  assert.throws(() => verifyE2eReceipt(lock, pair, e2e, run, {qaEntrySha256: 'f'.repeat(64)}), /E2E_RUNTIME_RECEIPT_MISMATCH/);
  const stale = JSON.stringify({...receipt, runId: '100'});
  assert.throws(() => verifyE2eReceipt(lock, {...pair, e2eReportSha256: digest(stale)}, stale, run, backendReceipt),
    /E2E_REPORT_RUN_MISMATCH/);
});

test('E2E compiler refuses runtime drift, stale receipts and incomplete evidence', t => {
  const reports = mkdtempSync(join(tmpdir(), 'locked-e2e-test-'));
  t.after(() => rmSync(reports, {recursive: true, force: true}));
  const {receipt} = actionsFixture('e2e');
  const runtime = {...lock, function: qaFunction, stagingUrl, version: 1, bundle, qaEntrySha256: bundle,
    sourceCommit: lock.backendSha, servedHashes: {'index.html': bundle, 'app.js': bundle, 'style.css': bundle},
    observedAt: secondsAgo(100)};
  const after = {...runtime, observedAt: secondsAgo(5)};
  const compile = proof => compileE2e(lock, runtime, proof, reports, receipt, now - 100000, now);
  assert.throws(() => compile({...after, version: 2}), /STAGING_RUNTIME_CHANGED_DURING_E2E/);
  assert.throws(() => compile(after), /ENOENT/);
  mkdirSync(join(reports, 'isolated-rc'));
  writeFileSync(join(reports, 'isolated-rc/issue99-real-performance.json'), JSON.stringify({runId: 'old-run', runAttempt: '1'}));
  assert.throws(() => compile(after), /WRONG_RECEIPT_RUN/);
});

test('provider download must reproduce the exact built bytes with no unexpected files', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'locked-api-test-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const expected = {'index.ts': 'source bytes', 'deno.json': '{}'};
  const form = new FormData();
  for (const [name, bytes] of Object.entries(expected)) {
    writeFileSync(join(directory, name), bytes);
    form.append(name, new Blob([bytes]), name);
  }
  await verifyDownloadedPackage(await new Response(form).formData(), directory);
  form.set('index.ts', new Blob(['older bytes']), 'index.ts');
  await assert.rejects(verifyDownloadedPackage(form, directory), /SERVED_QA_API_SOURCE_MISMATCH/);
  form.set('unexpected.ts', new Blob(['unexpected']), 'unexpected.ts');
  await assert.rejects(verifyDownloadedPackage(form, directory), /UNEXPECTED_QA_API_DOWNLOAD_PART/);
});

test('API health, access control and provider identity must prove the same locked pair', () => {
  const metadata = {slug: apiFunction, status: 'ACTIVE', verify_jwt: false, version: 3, ezbr_sha256: bundle};
  const health = {...lock, apiFunction, environment: 'production', projectRef: project, ok: true, release: version, contract: 'carrier-remedy-v1'};
  assert.deepEqual(verifyApiEvidence(lock, version, metadata, health, 403), api);
  assert.throws(() => verifyApiEvidence(lock, version, metadata, health, 200), /LOCKED_API_HEALTH_OR_ACCESS/);
  assert.throws(() => verifyApiEvidence(lock, version, metadata, {...health, frontendSha: 'f'.repeat(40)}, 403), /LOCKED_API_HEALTH_OR_ACCESS/);
  assert.throws(() => validateApiProof(lock, {...api, apiFunction: 'freight-api'}, version), /PAGES_REQUIRES/);
});

test('Pages bind the new route while retaining staging and the release history', () => {
  const files = new Map(Object.entries({
    'app.js': 'const x="https://'+project+'.supabase.co/functions/v1/freight-api"; const info={currentVersion:"'+'0'.repeat(20)+'"};',
    'index.html': '<script src="./app.js?v='+'0'.repeat(20)+'"></script>',
    'build-info.json': '{}',
    'site-status.json': '{}',
    'release-status.json': '{}',
    'test/app.js': 'staging script',
    'test/index.html': '<script src="./app.js"></script>',
    'test/staging-manifest.json': '{}'
  }).map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const history = {release: {version: current}, releases: [{version: current, title: 'Previous'}]};
  const manifest = bindPages(files, lock, api, {businessVersion: current}, history);
  assert.equal(manifest.businessVersion, version);
  assert.equal(manifest.apiFunction, apiFunction);
  assert.ok(files.get('app.js').includes(apiFunction));
  assert.equal(files.get('test/app.js').toString(), 'staging script');
  assert.deepEqual(JSON.parse(files.get('site-status.json')).releases[1], history.releases[0]);
  assert.throws(() => assertPreservesEntrypoints(files.get('index.html').toString(), '<script src="./current.js"></script>'),
    /LOCKED_FRONTEND_OMITS_LIVE_ASSET/);
});

test('the deployment graph puts confirmed backup and API health before publishing Pages', () => {
  const workflow = readFileSync('.github/workflows/owner-portal-release.yml', 'utf8');
  const legacy = readFileSync('.github/workflows/controlled-sh59-publish.yml', 'utf8');
  assert.equal((workflow.match(/runs-on: \[self-hosted, macOS, ARM64, freight-mac-qa\]/g)||[]).length, 3);
  // The coordinator must not occupy the only Mac runner while awaiting backend offline-safety.
  const backupJob = workflow.split('\n  backup:\n')[1].split('\n  deploy-pages:')[0];
  assert.match(backupJob, /runs-on: ubuntu-latest/);
  assert.doesNotMatch(backupJob, /self-hosted|Check native Mac release toolchain/);
  assert.match(workflow, /release-tests:\n    if: github.event_name == 'pull_request'\n    runs-on: ubuntu-latest/);
  assert.match(workflow, /needs: \[verify, backup\]/);
  assert.match(workflow, /verify:\n    if: .*github.actor == 'hakaru4i-afk'.*github.ref == 'refs\/heads\/main'.*workflow_dispatch/);
  assert.match(workflow, /if: inputs.publish\n[\s\S]*?run: node scripts\/release\/locked-release.mjs evidence/);
  assert.match(workflow, /needs\.backup\.result == 'success'/);
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.ok(workflow.indexOf('locked-release-api.mjs publish') < workflow.indexOf('actions/deploy-pages@v4'));
  assert.doesNotMatch(legacy, /actions\/deploy-pages@|^  workflow_dispatch:/m);
});
