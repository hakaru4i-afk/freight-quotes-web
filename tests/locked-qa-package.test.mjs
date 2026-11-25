import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {qaInputSha256, verifyQaPackageProof} from '../scripts/release/locked-qa-package.mjs';
import {stagingArtifact, verifyExpectedDeployment, verifyStagingProof, verifyStagingRun} from '../scripts/release/locked-qa-provenance.mjs';
import {verifyDownloadedHashes} from '../scripts/release/locked-qa-runtime.mjs';
import {digest, qaFunction, qaProject, web} from '../scripts/release/locked-release.mjs';

const lock = {frontendSha: 'a'.repeat(40), backendSha: 'b'.repeat(40)};
const input = 'c'.repeat(64);
const entry = 'const isolated = true;';
const config = '{"nodeModulesDir":"none"}';
const proof = {sourceCommit: lock.backendSha, qaInputSha256: input, entrySha256: digest(entry), configSha256: digest(config)};
const deployment = {project: qaProject, function: qaFunction, id: '498a5488-0363-4920-87ad-91f348ba6481', version: 48, bundle: 'd'.repeat(64)};

test('fingerprint binds immutable private source, build recipe and isolation, independently of frontend changes', t => {
  const work = mkdtempSync(join(tmpdir(), 'qa-input-test-'));
  t.after(() => rmSync(work, {recursive: true, force: true}));
  const git = (...args) => execFileSync('git', ['-C', work, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git('init', '-q');
  const source = join(work, 'src', 'transport-application');
  mkdirSync(source, {recursive: true});
  writeFileSync(join(source, 'index.ts'), entry);
  writeFileSync(join(source, 'deno.json'), config);
  git('add', '.');
  git('-c', 'user.name=QA', '-c', 'user.email=qa@example.test', 'commit', '-qm', 'Fixture');
  const first = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', first);
  const firstInput = qaInputSha256(work, {...lock, backendSha: first});
  assert.match(firstInput, /^[a-f0-9]{64}$/);
  assert.equal(firstInput, qaInputSha256(work, {frontendSha: 'e'.repeat(40), backendSha: first}));
  writeFileSync(join(source, 'deno.json'), '{}');
  assert.throws(() => qaInputSha256(work, {...lock, backendSha: first}), /EVIDENCE_SOURCE_FILES_MODIFIED/);
  git('add', '.');
  git('-c', 'user.name=QA', '-c', 'user.email=qa@example.test', 'commit', '-qm', 'Update configuration');
  const second = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', second);
  assert.notEqual(qaInputSha256(work, {...lock, backendSha: second}), firstInput);
  assert.throws(() => qaInputSha256(work, {...lock, backendSha: first}), /EVIDENCE_CHECKOUT_MISMATCH/);
});

test('receipt binds the current successful protected staging attempt', () => {
  const now = Date.parse('2026-11-25T15:00:00Z');
  const past = (seconds) => new Date(now - seconds * 1000).toISOString();
  const run = {
    id: 123, run_attempt: 2, repository: {full_name: web}, head_repository: {full_name: web},
    path: '.github/workflows/locked-qa-staging.yml', head_branch: 'main', head_sha: 'e'.repeat(40),
    event: 'workflow_dispatch', actor: {login: 'hakaru4i-afk'}, triggering_actor: {login: 'hakaru4i-afk'},
    status: 'completed', conclusion: 'success', run_started_at: past(120), updated_at: past(2)
  };
  const jobs = {total_count: 3, jobs: ['prepare', 'deploy', 'verify'].map(name => ({
    name, run_id: run.id, run_attempt: run.run_attempt, status: 'completed', conclusion: 'success'
  }))};
  const artifact = {id: 777, name: stagingArtifact(2), expired: false, created_at: past(5), expires_at: past(-60)};
  const receipt = {...lock, kind: 'qa-staging', runId: '123', attempt: '2', workflowSha: run.head_sha,
    generatedAt: past(8), package: proof, deployment};
  verifyStagingRun(run, jobs, artifact, now);
  assert.equal(verifyStagingProof(receipt, run), receipt);
  assert.throws(() => verifyStagingRun({...run, head_repository: {full_name: 'fork/freight-quotes-web'}}, jobs, artifact, now),
    /UNTRUSTED_QA_STAGING_RUN/);
  assert.throws(() => verifyStagingRun(run, {...jobs, jobs: jobs.jobs.map(job => ({...job, run_attempt: 1}))}, artifact, now),
    /UNTRUSTED_QA_STAGING_RUN/);
  assert.throws(() => verifyStagingRun(run, jobs, {...artifact, expired: true}, now), /UNTRUSTED_QA_STAGING_ARTIFACT/);
  assert.throws(() => verifyStagingProof({...receipt, attempt: '1'}, run), /QA_STAGING_RECEIPT_IDENTITY_MISMATCH/);
  assert.throws(() => verifyStagingProof({...receipt, deployment: {...deployment, project: 'production'}}, run),
    /QA_STAGING_RECEIPT_DEPLOYMENT_MISSING/);
  assert.throws(() => verifyQaPackageProof({...proof, qaInputSha256: 'f'.repeat(64)}, lock, input), /LOCKED_QA_PACKAGE_MISMATCH/);
});

test('independent provider readback rejects cache drift, missing files and mode changes', async () => {
  const metadata = {id: deployment.id, version: deployment.version, ezbr_sha256: deployment.bundle};
  const form = new FormData();
  form.append('source', new Blob([entry]), 'index.ts');
  form.append('source', new Blob([config]), 'deno.json');
  verifyExpectedDeployment(deployment, metadata);
  await verifyDownloadedHashes(form, proof, metadata);
  assert.throws(() => verifyExpectedDeployment(deployment, {...metadata, version: metadata.version + 1}),
    /SERVED_QA_API_DEPLOYMENT_DRIFT/);
  form.delete('source');
  form.append('source', new Blob([entry]), 'index.ts');
  await assert.rejects(verifyDownloadedHashes(form, proof, metadata), /SERVED_QA_API_SOURCE_MISMATCH/);
  form.append('source', new Blob(['{}']), 'deno.json');
  await assert.rejects(verifyDownloadedHashes(form, proof, metadata), /SERVED_QA_API_SOURCE_MISMATCH/);
  form.append('source', new Blob([entry]), 'index.ts');
  await assert.rejects(verifyDownloadedHashes(form, proof, metadata), /UNEXPECTED_QA_API_DOWNLOAD_PART/);
});

test('browser and backend evidence reuse staged package bytes without compiling or deploying them', () => {
  const read = name => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
  const e2e = read('isolated-qa-oidc-browser.yml');
  assert.match(e2e, /select-and-attest candidate-web candidate-backend/);
  assert.match(e2e, /attest candidate-web candidate-backend/);
  assert.doesNotMatch(e2e, /esbuild|locked-qa-runtime\.mjs build|prepare-api/);
  assert.doesNotMatch(read('locked-backend-regression.yml'), /locked-qa-runtime\.mjs build|prepare-api/);
  const staging = read('locked-qa-staging.yml');
  assert.match(staging, /locked-staging-attestation-attempt-/);
  assert.match(staging, /path: locked-staging-attestation\.json/);
  assert.doesNotMatch(staging, /path:.*\/api/);
});
