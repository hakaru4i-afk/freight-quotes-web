import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gh, ghJson, qaFunction, qaProject, requireCheck, requireFreshTime, sha40, sha64, validId, web} from './locked-release.mjs';
import {verifyQaPackageProof} from './locked-qa-package.mjs';

const stagingWorkflow = 'locked-qa-staging.yml';
export const stagingArtifact = attempt => 'locked-staging-attestation-attempt-' + attempt;
const maxAge = 14 * 24 * 60 * 60 * 1000;
const repository = 'repos/' + web + '/actions/';

export function verifyStagingRun(run, jobs, artifact, now = Date.now()) {
  const matchingJobs = Array.isArray(jobs?.jobs) && ['prepare', 'deploy', 'verify'].every(name => jobs.jobs.filter(job =>
    job.name === name && job.run_id === run?.id && job.run_attempt === run?.run_attempt &&
    job.status === 'completed' && job.conclusion === 'success').length === 1);
  requireCheck(run?.repository?.full_name === web && run.head_repository?.full_name === web &&
    run.path === '.github/workflows/' + stagingWorkflow && run.head_branch === 'main' && sha40.test(run.head_sha) &&
    run.event === 'workflow_dispatch' && run.actor?.login === 'hakaru4i-afk' && run.triggering_actor?.login === 'hakaru4i-afk' &&
    run.status === 'completed' && run.conclusion === 'success' && validId(run.id) && validId(run.run_attempt) &&
    jobs?.total_count === jobs?.jobs?.length && matchingJobs, 'UNTRUSTED_QA_STAGING_RUN');
  const start = Date.parse(run.run_started_at);
  const end = Date.parse(run.updated_at);
  requireFreshTime(run.run_started_at, now - maxAge, now);
  requireFreshTime(run.updated_at, start, now);
  requireCheck(artifact?.name === stagingArtifact(run.run_attempt) && validId(artifact.id) &&
    artifact.expired === false && Date.parse(artifact.expires_at) > now, 'UNTRUSTED_QA_STAGING_ARTIFACT');
  requireFreshTime(artifact.created_at, start, end);
}

export function verifyStagingProof(proof, run) {
  requireCheck(proof?.kind === 'qa-staging' && sha40.test(proof.frontendSha) && sha40.test(proof.backendSha) &&
    proof.runId === String(run.id) && proof.attempt === String(run.run_attempt) && proof.workflowSha === run.head_sha &&
    proof.package?.sourceCommit === proof.backendSha, 'QA_STAGING_RECEIPT_IDENTITY_MISMATCH');
  requireFreshTime(proof.generatedAt, Date.parse(run.run_started_at), Date.parse(run.updated_at));
  const deployment = proof.deployment;
  requireCheck(deployment?.project === qaProject && deployment.function === qaFunction &&
    /^[a-f0-9-]{36}$/.test(deployment.id) && validId(deployment.version) && sha64.test(deployment.bundle),
  'QA_STAGING_RECEIPT_DEPLOYMENT_MISSING');
  return proof;
}

export function verifyExpectedDeployment(expected, metadata) {
  requireCheck(expected?.id === metadata.id && expected.version === metadata.version &&
    expected.bundle === metadata.ezbr_sha256, 'SERVED_QA_API_DEPLOYMENT_DRIFT');
}

function downloadStagingProof(runId, name, token) {
  const directory = mkdtempSync(join(tmpdir(), 'qa-package-proof-'));
  try {
    gh(['run', 'download', String(runId), '--repo', web, '--name', name, '--dir', directory], token);
    return JSON.parse(readFileSync(join(directory, 'locked-staging-attestation.json'), 'utf8'));
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

export function findStagingProof(lock, inputSha256, token, {requireFrontend = true} = {}) {
  const now = Date.now();
  const list = ghJson(repository + 'workflows/' + stagingWorkflow +
    '/runs?branch=main&event=workflow_dispatch&status=success&per_page=30', token);
  requireCheck(Array.isArray(list?.workflow_runs), 'QA_STAGING_RUN_INVENTORY_UNAVAILABLE');
  for (const item of list.workflow_runs) {
    if (!validId(item.id) || !validId(item.run_attempt) || Date.parse(item.run_started_at) < now - maxAge) continue;
    const base = repository + 'runs/' + item.id;
    const name = stagingArtifact(item.run_attempt);
    const artifacts = ghJson(base + '/artifacts?name=' + name + '&per_page=100', token);
    requireCheck(artifacts.total_count === artifacts.artifacts?.length, 'QA_STAGING_ARTIFACT_INVENTORY_UNAVAILABLE');
    const matches = artifacts.artifacts.filter(artifact => artifact.name === name && !artifact.expired);
    if (!matches.length) continue;
    requireCheck(matches.length === 1, 'AMBIGUOUS_QA_STAGING_ARTIFACT');
    const run = ghJson(base, token);
    requireCheck(run.id === item.id && run.run_attempt === item.run_attempt, 'QA_STAGING_ATTEMPT_CHANGED');
    verifyStagingRun(run, ghJson(base + '/attempts/' + run.run_attempt + '/jobs?per_page=100', token), matches[0], now);
    const proof = verifyStagingProof(downloadStagingProof(run.id, name, token), run);
    if (proof.backendSha !== lock.backendSha || proof.package.qaInputSha256 !== inputSha256 ||
        (requireFrontend && proof.frontendSha !== lock.frontendSha)) continue;
    verifyQaPackageProof(proof.package, lock, inputSha256);
    const current = ghJson(base, token);
    requireCheck(current.run_attempt === run.run_attempt && current.status === 'completed' && current.conclusion === 'success',
      'QA_STAGING_ATTEMPT_CHANGED');
    return proof;
  }
  return null;
}
