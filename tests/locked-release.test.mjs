import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {approval, backend, backupWorkflow, nextVersion, project, readLock, targetFunction, validateLock, verifyBackup, verifyCandidateEvidence} from '../scripts/release/locked-release.mjs';
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
  assert.match(workflow, /needs: \[verify, backup\]/);
  assert.match(workflow, /needs\.backup\.result == 'success'/);
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.ok(workflow.indexOf('locked-release-api.mjs publish') < workflow.indexOf('actions/deploy-pages@v4'));
  assert.doesNotMatch(legacy, /actions\/deploy-pages@|^  workflow_dispatch:/m);
});
