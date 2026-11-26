import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {delimiter, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {approval, backend, backupWorkflow, currentBackupRun, digest, downloadBackupJobLog, parseBackupRestoreProof, evidenceWorkflows, findEvidenceRun, nextVersion, project, qaFunction, qaProject, readLock, stagingUrl, targetFunction, validateLock, verifyBackup, verifyCandidateEvidence, verifyE2eReceipt, verifyEvidenceRun, verifyRegressionReceipt, waitingForBackupGuest, waitForBackupRunIdentity, web} from '../scripts/release/locked-release.mjs';
import {compileE2e} from '../scripts/release/locked-e2e-evidence.mjs';
import {verifyDownloadedPackage,qaPackageFilename,verifyServedAssets} from '../scripts/release/locked-qa-runtime.mjs';
import {readSchemaVersion, verifyApiEvidence, verifyProductionPackage, verifyAuthContinuity} from '../scripts/release/locked-release-api.mjs';
import {assertPreservesEntrypoints, bindPages, publicationRecord, validateApiProof} from '../scripts/release/locked-release-pages.mjs';

const lock = {frontendSha: 'a'.repeat(40), backendSha: 'b'.repeat(40)};
const bundle = 'c'.repeat(64);
const current = 'SH-01.30.99 v';
const version = 'SH-01.31.00 v';
const apiFunction = targetFunction(lock);
const apiId = '0d4cedaf-3bcd-487b-b820-7b6a0b8d5a82';
const apiDeploymentId = [project, apiId, 3].join('_');
const api = {...lock, apiFunction, releaseVersion: version, apiVersion: 3, apiBundleSha256: bundle, apiDeploymentId};

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
    actor: {login: 'hakaru4i-afk'}, triggering_actor: {login: 'hakaru4i-afk'}, run_attempt: 2, display_title: 'Production backup 100'};
  const jobs = {total_count: 1, jobs: [{name: 'capture-and-readback', run_attempt: 2, status: 'completed', conclusion: 'success', labels: ['ubuntu-latest']}]};
  const proof = {result: 'PASS_CAPTURE_PAYLOAD_RESTORE_AND_CIPHERTEXT_READBACK', encrypted: true,
    offsiteReadback: true, ciphertextSha256: bundle, proof: {
      ciphertextSha256: bundle, databaseRestored: true, storageBytesRestored: true, isolationVerified: true,
      sourceCredentialsForwarded: false, ciphertextDecryptionVerified: true, verificationRecipientDestroyed: true
    }};
  const target = {id: 51, parent: '100'};
  assert.doesNotThrow(() => verifyBackup(run, jobs, proof, target));
  assert.throws(() => verifyBackup(run, jobs, proof, {...target, parent: '99'}), /BACKUP_PARENT/);
  assert.throws(() => verifyBackup({...run, conclusion: 'failure'}, jobs, proof, target), /RELEASE_PROOF_RUN/);
  assert.throws(() => verifyBackup({...run, run_attempt: 3}, jobs, proof, target), /CAPTURE_NOT_COMPLETED/);
  assert.throws(() => verifyBackup(run, jobs, {...proof, offsiteReadback: false}, target), /BACKUP_OR_RESTORE_PROOF/);
  assert.throws(() => verifyBackup(run, jobs, {...proof, proof: {...proof.proof, storageBytesRestored: false}}, target), /BACKUP_OR_RESTORE_PROOF/);
});

test('retry selects its original release-bound backup without starting another capture', () => {
  const run = {id: 51, display_title: 'Production backup 100', event: 'workflow_dispatch', head_branch: 'main',
    head_sha: lock.backendSha, actor: {login: 'hakaru4i-afk'}, conclusion: 'success'};
  assert.deepEqual(currentBackupRun([run, {...run, id: 52, conclusion: 'cancelled'}], '100', lock.backendSha), run);
  assert.equal(currentBackupRun([run], '101', lock.backendSha), null);
  assert.throws(() => currentBackupRun([run, {...run, id: 52}], '100', lock.backendSha), /DUPLICATE_RELEASE_BOUND_BACKUP/);
  assert.throws(() => currentBackupRun([run], '100', lock.frontendSha), /UNTRUSTED_EXISTING_RELEASE_BACKUP/);
});

test('hosted fallback is allowed only while the dedicated guest is unassigned and no capture has started', () => {
  const readiness = {name: 'protected-readiness', status: 'queued', runner_name: ''};
  assert.equal(waitingForBackupGuest({total_count: 1, jobs: [readiness]}), true);
  assert.equal(waitingForBackupGuest({total_count: 1, jobs: [{...readiness, runner_name: 'backup'}]}), false);
  assert.equal(waitingForBackupGuest({total_count: 2, jobs: [readiness, {name: 'capture-and-readback', status: 'in_progress', runner_name: 'backup'}]}), false);
  assert.equal(waitingForBackupGuest({total_count: 1, jobs: [{...readiness, name: 'capture-and-readback'}]}), true);
});

test('backup preflight reports only a fixed phase and safe GitHub status', t => {
  const directory = mkdtempSync(join(tmpdir(), 'backup-preflight-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const credential = 'SYNTHETIC_BACKUP_CREDENTIAL';
  writeFileSync(join(directory, 'release-lock.json'), JSON.stringify(lock));
  writeFileSync(join(directory, 'gh'), `#!/usr/bin/env node
const path = process.argv[3];
const [phase, response] = [
  ['MAIN_REF', {object: {sha: '${lock.backendSha}'}}, '/git/ref/heads/main'],
  ['RUN_INVENTORY', {workflow_runs: []}, '/runs?'],
  ['DISPATCH', {}, '/dispatches']
].find(([, , part]) => path.includes(part)) ?? [];
if (!phase) process.exit(2);
if (phase !== process.env.FIXTURE_BACKUP_PHASE) {
  console.log(JSON.stringify(response));
} else {
  const failure = process.env.FIXTURE_BACKUP_FAILURE;
  console.log('untrusted response ' + process.env.GH_TOKEN);
  if (failure === 'INVALID_JSON') process.exit(0);
  const detail = 'untrusted error ' + process.env.GH_TOKEN;
  console.error(failure === 'COMMAND_FAILED' ? detail : 'gh: ' + detail + ' (HTTP ' + failure + ')');
  process.exit(1);
}
`, {mode: 0o700});
  const script = fileURLToPath(new URL('../scripts/release/locked-release.mjs', import.meta.url));
  const invoke = (phase, failure, token = credential) => spawnSync(process.execPath, [script, 'backup'], {
    cwd: directory, encoding: 'utf8', env: {...process.env, PATH: directory + delimiter + process.env.PATH,
      BACKEND_RELEASE_TOKEN: token, GITHUB_RUN_ID: '100', GITHUB_OUTPUT: '',
      FIXTURE_BACKUP_PHASE: phase, FIXTURE_BACKUP_FAILURE: failure}
  });
  for (const [phase, failure, suffix] of [
    ['MAIN_REF', '401', 'HTTP_401'], ['RUN_INVENTORY', '403', 'HTTP_403'], ['DISPATCH', '422', 'HTTP_422'],
    ['MAIN_REF', 'INVALID_JSON', 'INVALID_JSON'], ['DISPATCH', 'INVALID_JSON', 'INVALID_JSON'],
    ['RUN_INVENTORY', 'COMMAND_FAILED', 'COMMAND_FAILED']
  ]) {
    const result = invoke(phase, failure);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.trim(), 'BACKUP_GITHUB_' + phase + '_' + suffix);
  }
  assert.equal(invoke('MAIN_REF', '401', '').stderr.trim(), 'RELEASE_GITHUB_CREDENTIAL_UNAVAILABLE');
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

test('discovery selects the latest exact Owner dispatch and leaves the proof gate in force', () => {
  const {run} = actionsFixture('frontend');
  const different = 'e'.repeat(40);
  const candidates = [run,
    {...run, id: 197, run_started_at: secondsAgo(30), head_sha: different},
    {...run, id: 198, run_started_at: secondsAgo(20), status: 'completed', conclusion: 'failure'},
    {...run, id: 199, run_started_at: secondsAgo(5), event: 'pull_request'},
    {...run, id: 200, run_started_at: secondsAgo(5), actor: {login: 'other'}},
    {...run, id: 201, run_started_at: secondsAgo(86401)}];
  const lookup = sha => sha === different ? {...lock, backendSha: sha} : lock;
  assert.equal(findEvidenceRun(lock, candidates, lookup, now), 198);
  assert.equal(findEvidenceRun(lock, candidates, () => ({frontendSha: different}), now), null);
  assert.throws(() => verifyEvidenceRun('frontend', candidates[2], {}, {}, 198, now), /RELEASE_PROOF_RUN_MISMATCH/);
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
  const inputSha = 'e'.repeat(64);
  assert.doesNotThrow(() => verifyE2eReceipt(lock, {...pair, qaInputSha256: inputSha}, e2e, run, {qaInputSha256: inputSha}));
  assert.throws(() => verifyE2eReceipt(lock, {...pair, qaInputSha256: inputSha}, e2e, run, backendReceipt), /E2E_RUNTIME_RECEIPT_MISMATCH/);
  const stale = JSON.stringify({...receipt, runId: '100'});
  assert.throws(() => verifyE2eReceipt(lock, {...pair, e2eReportSha256: digest(stale)}, stale, run, backendReceipt),
    /E2E_REPORT_RUN_MISMATCH/);
});

test('E2E compiler refuses runtime drift, stale receipts and incomplete evidence', t => {
  const reports = mkdtempSync(join(tmpdir(), 'locked-e2e-test-'));
  t.after(() => rmSync(reports, {recursive: true, force: true}));
  const {receipt} = actionsFixture('e2e');
  const runtime = {...lock, function: qaFunction, stagingUrl, version: 1, bundle, qaEntrySha256: bundle,
    qaInputSha256: bundle,
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
  const metadata = {id: apiId, slug: apiFunction, status: 'ACTIVE', verify_jwt: false, version: 3, ezbr_sha256: bundle};
  const health = {...lock, apiFunction, environment: 'production', projectRef: project, ok: true, release: version,
    contract: 'carrier-remedy-v1', deploymentId: apiDeploymentId};
  assert.deepEqual(verifyApiEvidence(lock, version, metadata, health, 403), api);
  assert.throws(() => verifyApiEvidence(lock, version, metadata, health, 200), /LOCKED_API_HEALTH_OR_ACCESS/);
  assert.throws(() => verifyApiEvidence(lock, version, metadata, {...health, frontendSha: 'f'.repeat(40)}, 403), /LOCKED_API_HEALTH_OR_ACCESS/);
  assert.throws(() => verifyApiEvidence(lock, version, metadata, {...health, deploymentId: 'old'}, 403), /LOCKED_API_HEALTH_OR_ACCESS/);
  assert.throws(() => validateApiProof(lock, {...api, apiFunction: 'freight-api'}, version), /PAGES_REQUIRES/);
});

test('production API readback rejects old bytes, incomplete packages and a different provider deployment', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'production-api-test-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const form = new FormData();
  for (const [name, bytes] of [['index.ts', 'source'], ['deno.json', '{}'], ['task.ts', 'module']]) {
    writeFileSync(join(directory, name), bytes);
    form.set(name, new Blob([bytes]), '/tmp/user_fn_' + apiDeploymentId + '/source/' + name);
  }
  await verifyProductionPackage(form, directory, apiDeploymentId);
  await assert.rejects(verifyProductionPackage(form, directory, apiDeploymentId.replace(/3$/, '2')), /DOWNLOAD_PART/);
  form.delete('task.ts');
  await assert.rejects(verifyProductionPackage(form, directory, apiDeploymentId), /SOURCE_MISSING/);
  form.set('task.ts', new Blob(['old']), 'task.ts');
  await assert.rejects(verifyProductionPackage(form, directory, apiDeploymentId), /SOURCE_MISMATCH/);
});

test('schema is observed from production migration history', async () => {
  const migration = version => ({version});
  const read = data => async url => {
    assert.match(url, new RegExp(project + '/database/migrations$'));
    return Response.json(data);
  };
  assert.equal(await readSchemaVersion('fixture', read([migration('20261124111013'), migration('20261125081126')])), '20261125081126');
  await assert.rejects(readSchemaVersion('fixture', read([migration('stale')])), /MIGRATION_HISTORY_INVALID/);
  await assert.rejects(readSchemaVersion('fixture', async () => new Response(null, {status: 403})), /MIGRATION_HISTORY_HTTP_403/);
});

test('Pages bind the new route while retaining staging and the release history', () => {
  const files = new Map(Object.entries({
    'app.js': 'import {stagingRegionalUrl} from "./staging-api-region.mjs?v='+'0'.repeat(20)+'"; const x="https://'+project+'.supabase.co/functions/v1/freight-api"; const info={currentVersion:"'+'0'.repeat(20)+'"};',
    'staging-api-region.mjs': 'reviewed region module',
    'staging-transport-20261111.js': 'reviewed wrapper',
    'index.html': '<script src="./app.js?v='+'0'.repeat(20)+'"></script>' +
      '<script src="./portal-feedback-center-20261107.js?v='+'0'.repeat(12)+'"></script>' +
      '<script src="./staging-transport-20261111.js?v='+'0'.repeat(20)+'"></script>',
    'portal-feedback-center-20261107.js': 'previous Owner center',
    'test/portal-feedback-center-20261107.js': 'attested Owner center',
    'build-info.json': '{}',
    'site-status.json': '{}',
    'release-status.json': '{}',
    'test/app.js': 'staging script',
    'test/index.html': '<script src="./app.js"></script>',
    'test/staging-manifest.json': '{}'
  }).map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const history = {release: {version: current}, releases: [{version: current, title: 'Previous'}]};
  const proof = {...api, schemaVersion: '20261124111013'};
  const actions = {runId: '200', attempt: '2', workflowSha: lock.frontendSha};
  const evidence = Object.fromEntries(['frontend', 'backend', 'e2e'].map((kind, index) => [kind, {...actions, runId: String(196 + index)}]));
  const backup = {runId: '199', attempt: '1', ciphertextSha256: bundle};
  const publication = publicationRecord(proof, actions, evidence, backup);
  assert.throws(() => publicationRecord(proof, actions, {...evidence, e2e: null}, backup), /PRODUCTION_ACTION_RECEIPTS_MISSING/);
  assert.throws(() => publicationRecord({...proof, apiDeploymentId: 'old'}, actions, evidence, backup), /PRODUCTION_API_OR_SCHEMA_RECEIPT_MISSING/);
  const manifest = bindPages(files, lock, proof, {businessVersion: current}, history, publication);
  assert.equal(manifest.businessVersion, version);
  assert.equal(manifest.apiFunction, apiFunction);
  assert.equal(manifest.databaseSchemaVersion, proof.schemaVersion);
  assert.deepEqual(manifest.actions, actions);
  assert.deepEqual(manifest.evidence, evidence);
  assert.deepEqual(manifest.backup, {runId: '199', attempt: '1'});
  assert.equal(manifest.previous.businessVersion, current);
  assert.equal(files.get('portal-feedback-center-20261107.js').toString(), 'attested Owner center');
  assert.ok(files.get('index.html').includes(digest(files.get('portal-feedback-center-20261107.js')).slice(0, 12)));
  assert.ok(files.get('app.js').includes(apiFunction));
  assert.ok(files.get('app.js').includes(digest(files.get('staging-api-region.mjs')).slice(0,20)));
  assert.ok(files.get('index.html').includes(digest(files.get('staging-transport-20261111.js')).slice(0,20)));
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
  assert.match(workflow, /if: inputs.publish\n[\s\S]*?node scripts\/release\/locked-release.mjs evidence/);
  assert.match(workflow, /needs\.backup\.result == 'success'/);
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.ok(workflow.indexOf('locked-release-api.mjs publish') < workflow.indexOf('actions/deploy-pages@v4'));
  assert.ok(workflow.indexOf('snapshot candidate-web') < workflow.indexOf('locked-release-api.mjs publish'));
  assert.match(workflow, /failure\(\) && steps.deployment.outcome == 'success' && steps.readback.outcome == 'failure'/);
  assert.match(workflow, /artifact_name: rollback-pages/);
  assert.doesNotMatch(legacy, /actions\/deploy-pages@|^  workflow_dispatch:/m);
});

test('QA reads the private backend with separate environment credential and fails closed', async () => {
  const {checkQaCredentials}=await import('../scripts/release/check-qa-credentials.mjs');
  const env={BACKEND_QA_READ_TOKEN:'synthetic-not-real',SUPABASE_ACCESS_TOKEN:'synthetic-not-real'};
  const mock=async()=>({ok:true,json:async()=>({sha:lock.backendSha})});
  assert.equal(await checkQaCredentials('e2e',env,mock,lock),'BACKEND_QA_EXACT_SOURCE_READ_PASS');
  await assert.rejects(checkQaCredentials('e2e',{},mock,lock),/MISSING_QA_SECRET:BACKEND_QA_READ_TOKEN,SUPABASE_ACCESS_TOKEN/);
  await assert.rejects(checkQaCredentials('backend',env,async()=>({ok:false,status:403}),lock),/BACKEND_QA_READ_HTTP_403/);
  await assert.rejects(checkQaCredentials('backend',env,async()=>({ok:true,json:async()=>({sha:'0'.repeat(40)})}),lock),/BACKEND_QA_READ_SHA_MISMATCH/);
  for(const path of ['.github/workflows/locked-backend-regression.yml','.github/workflows/isolated-qa-oidc-browser.yml']){
    const workflow=readFileSync(path,'utf8');
    assert.match(workflow,/environment: isolated-qa/);
    assert.match(workflow,/secrets\.BACKEND_QA_READ_TOKEN/);
    assert.doesNotMatch(workflow,/secrets\.BACKEND_RELEASE_TOKEN/);
    assert.match(workflow,/check-qa-credentials\.mjs/);
  }
});


test('Provider qualified source paths normalize only for the exact deployment', () => {
 const metadata={id:'0d4cedaf-3bcd-487b-b820-7b6a0b8d5a82',version:45};
 const prefix='/tmp/user_fn_'+[qaProject,metadata.id,metadata.version].join('_')+'/';
 assert.equal(qaPackageFilename(prefix+'source/index.ts',metadata),'index.ts');
 assert.equal(qaPackageFilename('source/deno.json',metadata),'deno.json');
 assert.equal(qaPackageFilename('index.ts',metadata),'index.ts');
 for(const path of [prefix+'source/../index.ts',prefix+'source/extra.ts','wrong/index.ts','/tmp/other/source/index.ts'])assert.throws(()=>qaPackageFilename(path,metadata),/UNEXPECTED_QA_API_DOWNLOAD_PART/);
 assert.throws(()=>qaPackageFilename(prefix+'source/index.ts',{...metadata,version:46}),/UNEXPECTED_QA_API_DOWNLOAD_PART/);
});
test('Provider-qualified package verifies every byte and rejects duplicate aliases',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'qa-paths-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const metadata={id:'0d4cedaf-3bcd-487b-b820-7b6a0b8d5a82',version:45};
 const prefix='/tmp/user_fn_'+[qaProject,metadata.id,metadata.version].join('_')+'/source/';
 const form=new FormData();for(const [name,bytes] of Object.entries({'index.ts':'source bytes','deno.json':'{}'})){writeFileSync(join(directory,name),bytes);form.append('file',new Blob([bytes]),prefix+name)}
 await verifyDownloadedPackage(form,directory,metadata);
 form.append('file',new Blob(['source bytes']),'index.ts');await assert.rejects(verifyDownloadedPackage(form,directory,metadata),/UNEXPECTED_QA_API_DOWNLOAD_PART/);
});

test('independent served asset reads start together and preserve exact hashes', async t => {
  const root = mkdtempSync(join(tmpdir(), 'locked-parallel-assets-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, 'test'));
  const names = ['index.html', 'app.js', 'style.css'];
  for (const name of names) writeFileSync(join(root, 'test', name), name);
  const started = [], finish = [];
  const result = verifyServedAssets(root, url => new Promise(resolve => {
    const name = new URL(url).pathname.split('/').pop();
    started.push(name);
    finish.push(() => resolve(new Response(name)));
  }));
  assert.deepEqual(started, names);
  finish.forEach(done => done());
  assert.deepEqual(await result, Object.fromEntries(names.map(name => [name, digest(name)])));
  await assert.rejects(verifyServedAssets(root, async url => {
    const name = new URL(url).pathname.split('/').pop();
    return new Response(name === 'app.js' ? 'wrong bytes' : name);
  }), /SERVED_STAGING_ASSET_MISMATCH:app.js/);
});


test('backup proof log follows signed HTTPS redirect without forwarding credential', async () => {
  const calls = [];
  const credential = 'SYNTHETIC_SECRET';
  const log = '2026-11-26T11:12:42.5908397Z CAPTURE_RESTORE_PROOF {"result":"PASS"}\n';
  const fetcher = async (url, options) => {
    calls.push({url, options});
    return calls.length === 1 ? new Response(null, {status: 302, headers: {location: 'https://logs.example.test/signed'}}) : new Response(log);
  };
  assert.equal(await downloadBackupJobLog(123, credential, fetcher), log);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ' + credential);
  assert.equal(calls[1].options.headers, undefined);
  assert.equal(calls[1].options.redirect, 'error');
  assert.deepEqual(parseBackupRestoreProof(log), {result: 'PASS'});
  assert.throws(() => parseBackupRestoreProof(log + log), /BACKUP_RESTORE_PROOF_MISSING/);
  assert.throws(() => parseBackupRestoreProof('2026-11-26T11:12:42Z CAPTURE_RESTORE_PROOF {broken'), /BACKUP_RESTORE_PROOF_INVALID_JSON/);
  await assert.rejects(downloadBackupJobLog(123, credential, async () => new Response(null, {status:403}), async () => {}), /BACKUP_GITHUB_LOG_HTTP_403/);
  await assert.rejects(downloadBackupJobLog(123, credential, async () => new Response(null, {status:302,headers:{location:'http://logs.example.test/'}}), async () => {}), /BACKUP_GITHUB_LOG_REDIRECT_INVALID/);
});

test('backup proof log retries delayed availability and reports transport failure without secrets', async () => {
  let calls = 0;
  const pauses = [];
  const log = await downloadBackupJobLog(123, 'secret', async () => {
    calls++;
    if (calls === 1) return new Response(null, {status:404});
    if (calls === 2) return new Response(null, {status:302,headers:{location:'https://logs.example.test/signed'}});
    return new Response('proof');
  }, async ms => pauses.push(ms));
  assert.equal(log, 'proof');
  assert.deepEqual(pauses, [2000]);
  await assert.rejects(downloadBackupJobLog(123, 'secret', async () => { throw Error('private signed URL secret'); }, async () => {}), {message:'BACKUP_GITHUB_LOG_TRANSPORT_FAILED'});
});


test('backup dispatch waits for exact identity without creating another run', async () => {
  const run = {id: 51, head_sha: lock.backendSha, display_title: 'Production backup 100',
    repository: {full_name: backend}, path: '.github/workflows/' + backupWorkflow,
    head_branch: 'main', event: 'workflow_dispatch', actor: {login: 'hakaru4i-afk'}, status: 'queued'};
  const target = {id: 51, parent: '100', workflowSha: lock.backendSha};
  let reads = 0;
  const delays = [];
  assert.deepEqual(await waitForBackupRunIdentity(id => {
    assert.equal(id, 51);
    reads++;
    if (reads === 1) throw Error('BACKUP_GITHUB_RUN_READBACK_HTTP_404');
    if (reads === 2) return {...run, display_title: ''};
    return run;
  }, target, async ms => delays.push(ms)), run);
  assert.equal(reads, 3);
  assert.deepEqual(delays, [5000, 5000]);
  for (const bad of [{id: 52}, {head_sha: lock.frontendSha}, {display_title: 'Production backup 99'},
    {repository: {full_name: web}}, {path: '.github/workflows/other.yml'},
    {head_branch: 'other'}, {event: 'push'}, {actor: {login: 'other'}}]) {
    let count = 0;
    await assert.rejects(waitForBackupRunIdentity(() => {count++; return {...run, ...bad};}, target, async () => {}), /BACKUP_DISPATCH_IDENTITY_CHANGED/);
    assert.equal(count, 7);
  }
  await assert.rejects(waitForBackupRunIdentity(() => {throw Error('BACKUP_GITHUB_RUN_READBACK_HTTP_403');}, target, async () => {assert.fail('must not retry forbidden access');}), /HTTP_403/);
});


test('direct production snapshot CLI exits successfully and preserves exact root and candidate staging', t => {
  const dir = mkdtempSync(join(tmpdir(), 'locked-pages-cli-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const candidate = join(dir, 'candidate'), out = join(dir, 'rollback');
  mkdirSync(candidate); mkdirSync(join(candidate, 'test'));
  const root = {'index.html':'<script src="./app.js"></script>', 'app.js':'live application', 'style.css':'live style',
    'build-info.json':'{}','site-status.json':'{}'};
  const manifest = {environment:'production',publicationState:'PUBLISHED',
    assets:Object.fromEntries(Object.entries(root).map(([name,value])=>[name,digest(Buffer.from(value))]))};
  root['production-release-manifest.json'] = JSON.stringify(manifest);
  const files = {...root,'app.js':'candidate root must not replace live root','release-status.json':'{}',
    'test/index.html':'candidate staging html','test/app.js':'candidate staging script','test/style.css':'candidate staging style',
    'test/staging-manifest.json':'{}','test/staging-transport-20261111.js':'LOCKED_STAGING_ISOLATION_V1'};
  for (const [name,value] of Object.entries(files)) writeFileSync(join(candidate,name),value);
  const git = (...args) => {
    const result = spawnSync('git',['-C',candidate,...args],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return result.stdout.trim();
  };
  git('init','-q'); git('add','.'); git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');
  writeFileSync(join(dir,'release-lock.json'),JSON.stringify({frontendSha:git('rev-parse','HEAD'),backendSha:lock.backendSha}));
  const preload = 'globalThis.fetch = async url => { const root = ' + JSON.stringify(root) +
    '; const name = new URL(url).pathname.split("/freight-quotes-web/")[1]; return Object.hasOwn(root,name) ? new Response(root[name]) : new Response("",{status:404}); };';
  const script = fileURLToPath(new URL('../scripts/release/locked-release-pages.mjs',import.meta.url));
  const result = spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),script,'snapshot',candidate,out],
    {cwd:dir,encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr || String(result.error));
  assert.equal(readFileSync(join(out,'app.js'),'utf8'),root['app.js']);
  assert.equal(readFileSync(join(out,'production-release-manifest.json'),'utf8'),root['production-release-manifest.json']);
  assert.equal(readFileSync(join(out,'test/app.js'),'utf8'),files['test/app.js']);
});

test('release rejects any unreviewed live login, password hash, session or database contract change',()=>{
 const live=[
  'var DATA_SCHEMA = "freight";','var DEPLOYMENT_ENV = "production";','var sql = postgres(Deno.env.get("SUPABASE_DB_URL"));',
  'async function passwordHash2(password,salt){return hash(password,salt)}',
  'async function createSession2(userId){return session(userId)}','async function lookupSiteUser2(){return user}',
  'const route_auth = loginHandler;','const route_bids = bidsHandler;',
  'const route_session = sessionHandler;','const route_shipments = shipmentsHandler;'
 ].join('\n');
 assert.doesNotThrow(()=>verifyAuthContinuity(live,live.replace('bidsHandler','updatedBidsHandler')));
 for(const [from,to] of [['loginHandler','changedLogin'],['hash(password,salt)','newHash(password,salt)'],['session(userId)','newSession(userId)'],['sessionHandler','changedSession'],['"freight"','"other"'],['"production"','"staging"']])
  assert.throws(()=>verifyAuthContinuity(live,live.replace(from,to)),/AUTH_CONTINUITY_/);
});
test('login smoke reports the first actual rejection without retrying passwords',()=>{
 const source=readFileSync('scripts/release/production-authenticated-browser.mjs','utf8');
 assert.match(source,/loginAttempts<1/);
 assert.match(source,/PRODUCTION_LOGIN_REJECTED_401/);
 assert.match(source,/PRODUCTION_LOGIN_RATE_LIMIT_429/);
 assert.match(source,/PRODUCTION_LOGIN_NETWORK_FAILURE/);
 assert.match(source,/PRODUCTION_LOGIN_NOT_COMPLETED/);
 assert.doesNotMatch(source,/console\.(?:log|error)\([^\n]*(?:postDataJSON|sessionToken|password)\b/);
});
