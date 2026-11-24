import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const web = 'hakaru4i-afk/freight-quotes-web';
export const backend = 'hakaru4i-afk/freight-quotes';
export const project = 'ooclsrndeygojtofuyte';
export const site = 'https://hakaru4i-afk.github.io/freight-quotes-web/';
export const backupWorkflow = 'issue29-production-backup-gate.yml';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const sha40 = /^[a-f0-9]{40}$/;
export const sha64 = /^[a-f0-9]{64}$/;
const releasePattern = /^SH-(\d{2})\.(\d{2})\.(\d{2}) v$/;
const ids = [
  ...Array.from({length: 11}, (_, i) => 'T1-' + String(i + 1).padStart(2, '0')),
  ...Array.from({length: 26}, (_, i) => 'T2-' + String(i + 1).padStart(2, '0'))
];

export function requireCheck(ok, code) {
  if (!ok) throw Error(code);
}

export function validateLock(lock) {
  requireCheck(lock && Object.keys(lock).sort().join(',') === 'backendSha,frontendSha' &&
    sha40.test(lock.frontendSha) && sha40.test(lock.backendSha), 'INVALID_TWO_SHA_RELEASE_LOCK');
  return lock;
}

export function readLock(path = 'release-lock.json') {
  return validateLock(JSON.parse(readFileSync(path, 'utf8')));
}

export const targetFunction = lock => 'freight-api-release-' + digest(validateLock(lock).frontendSha + lock.backendSha).slice(0, 32);

export function nextVersion(current) {
  const match = releasePattern.exec(current);
  requireCheck(match, 'INVALID_PUBLISHED_RELEASE_VERSION');
  const serial = Number(match.slice(1).join('')) + 1;
  requireCheck(serial <= 999999, 'RELEASE_VERSION_SPACE_EXHAUSTED');
  return 'SH-' + String(serial).padStart(6, '0').match(/../g).join('.') + ' v';
}

export const approval = lock => 'APPROVE FRONTEND=' + lock.frontendSha + ' BACKEND=' + lock.backendSha;

export async function readCurrentSite(fetcher = fetch) {
  const options = {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000)};
  const fetchJson = async path => {
    const url = new URL(path, site);
    url.searchParams.set('verify', String(Date.now()));
    const response = await fetcher(url, options);
    requireCheck(response.ok, 'LIVE_PAGES_METADATA_HTTP_' + response.status);
    return response.json();
  };
  const [manifest, build] = await Promise.all([fetchJson('production-release-manifest.json'), fetchJson('build-info.json')]);
  requireCheck(manifest.environment === 'production' && build.environment === 'production' &&
    manifest.businessVersion === build.releaseVersion && manifest.frontendBuild === build.build,
  'LIVE_PAGES_RELEASE_RECEIPT_MISMATCH');
  return manifest;
}

export function verifyCandidateEvidence(lock, {pair, regression, security, e2e}) {
  requireCheck(pair?.frontendSha === lock.frontendSha && pair?.servedFrontendSha === lock.frontendSha &&
    pair?.backendSha === lock.backendSha && sha64.test(pair?.apiBundleSha256) && pair?.servedApiVerified === true,
  'TESTED_RUNTIME_PAIR_MISMATCH');
  requireCheck(regression?.commit === lock.frontendSha && regression?.checks?.FAIL === 0 &&
    regression?.checks?.BLOCKED === 0 && Array.isArray(regression.scenarios) &&
    regression.scenarios.length === ids.length && ids.every(id =>
      regression.scenarios.some(x => x.id === id && ['PARTIAL', 'PASS'].includes(x.status))), 'FRONTEND_REGRESSION_MISSING');
  requireCheck(security?.status === 'PASS' && Array.isArray(security.checks) &&
    security.checks.every(check => check.status === 'PASS') &&
    ['private_tables_and_RLS', 'mutation_rolls_back_rows_and_schema'].every(id => security.checks.some(check => check.id === id)),
  'BACKEND_SECURITY_OR_SCHEMA_PROOF_MISSING');
  const list = e2e?.scenarios;
  requireCheck(e2e?.frontendSha === lock.frontendSha && e2e?.backendSha === lock.backendSha &&
    e2e?.environment === 'isolated-qa' && e2e?.authorized === true && Array.isArray(e2e.criticalDefects) &&
    e2e.criticalDefects.length === 0 && Array.isArray(list) && list.length === ids.length &&
    new Set(list.map(x => x.id)).size === ids.length && ids.every(id => list.some(x =>
      x.id === id && x.status === 'PASS' && x.mode === 'AUTHENTICATED_QA_API' && x.actorRole &&
      x.evidence?.method === 'HTTP_AND_BROWSER' && x.evidence?.responseVerified === true && x.evidence?.traceId)),
  'AUTHENTICATED_37_SCENARIOS_MISSING');
}

export function gh(args, token, opts = {}) {
  requireCheck(token, 'RELEASE_GITHUB_CREDENTIAL_UNAVAILABLE');
  return execFileSync('gh', args, {
    ...opts, env: {...process.env, GH_TOKEN: token}, encoding: 'utf8',
    stdio: [opts.input ? 'pipe' : 'ignore', 'pipe', 'ignore'], timeout: 60000, maxBuffer: 8 * 1024 * 1024
  });
}

export const ghJson = (path, token, opts) => JSON.parse(gh(['api', path, ...opts?.args ?? []], token, opts));
export const validId = id => /^[1-9][0-9]*$/.test(String(id)) && Number.isSafeInteger(Number(id));

function verifyRun(run, {repo, path, id, sha}) {
  requireCheck(run?.id === Number(id) && run.repository?.full_name === repo && run.path === '.github/workflows/' + path &&
    run.head_branch === 'main' && (!sha || run.head_sha === sha) && run.event === 'workflow_dispatch' &&
    run.status === 'completed' && run.conclusion === 'success', 'RELEASE_PROOF_RUN_MISMATCH:' + path);
}

function fetchEvidence(lock, env) {
  const webToken = env.WEB_TOKEN;
  const backendToken = env.BACKEND_RELEASE_TOKEN;
  const entries = [
    [web, 'release-stabilization.yml', env.FRONTEND_RUN_ID, lock.frontendSha, webToken, 'release-stabilization-robot-evidence', 'frontend'],
    [backend, 'release-stabilization.yml', env.BACKEND_RUN_ID, lock.backendSha, backendToken, 'release-migration-and-support-evidence', 'backend']
  ];
  const root = resolve(env.RUNNER_TEMP, 'locked-candidate-evidence');
  for (const [repo, path, id, sha, token, artifact, folder] of entries) {
    requireCheck(validId(id), 'RELEASE_PROOF_RUN_ID_REQUIRED:' + folder);
    const base = 'repos/' + repo + '/actions/runs/' + id;
    verifyRun(ghJson(base, token), {repo, path, id, sha});
    const expected = folder === 'frontend' ? ['regression', 'complete-regression'] : ['regression', 'schema-transition'];
    const result = ghJson(base + '/jobs?per_page=100', token);
    requireCheck(result.total_count === result.jobs?.length && expected.every(name => result.jobs.some(job =>
      job.name === name && job.status === 'completed' && job.conclusion === 'success')), 'REQUIRED_RELEASE_JOB_NOT_PASSED');
    gh(['run', 'download', id, '--repo', repo, '--name', artifact, '--dir', resolve(root, folder)], token);
  }
  const e2eId = env.E2E_RUN_ID;
  requireCheck(validId(e2eId), 'RELEASE_PROOF_RUN_ID_REQUIRED:e2e');
  const audit = ghJson('repos/' + web + '/actions/runs/' + e2eId, webToken);
  // This trusted historical workflow can attest an exact pair. Its name is a GitHub identity,
  // and no old business version is used to authorize the next release.
  const legacyAudit = audit.workflow_id === 425270795;
  const path = legacyAudit ? 'sh59-protected-37-audit.yml' : 'isolated-qa-oidc-browser.yml';
  const artifact = legacyAudit ? 'sh59-protected-37-audit-summary' : 'locked-release-evidence';
  verifyRun(audit, {repo: web, path, id: e2eId});
  gh(['run', 'download', e2eId, '--repo', web, '--name', artifact, '--dir', resolve(root, 'e2e')], webToken);
  const read = (folder, name) => {
    const directory = resolve(root, folder);
    const matches = readdirSync(directory, {recursive: true, withFileTypes: true}).filter(file => file.isFile() && file.name === name);
    requireCheck(matches.length === 1, 'RELEASE_EVIDENCE_FILE_NOT_UNIQUE:' + name.toUpperCase());
    return JSON.parse(readFileSync(resolve(matches[0].parentPath, name), 'utf8'));
  };
  const e2e = read('e2e', 'private-authenticated-e2e.json');
  const pair = legacyAudit ? {
    frontendSha: e2e.frontendSha, servedFrontendSha: e2e.frontendSha, backendSha: e2e.backendSha,
    apiBundleSha256: e2e.backendBundle, servedApiVerified:
      e2e.publishedAcceptance?.site === new URL('test/', site).href &&
      sha64.test(e2e.publishedAcceptance?.receiptSha256) && e2e.publishedAcceptance?.verifiedBrowserReceipts > 0
  } : read('e2e', 'release-gate-pair.json');
  verifyCandidateEvidence(lock, {
    pair,
    regression: read('frontend', 'task12-robot-matrix.json'),
    security: read('backend', 'schema-transition-rehearsal.json'),
    e2e
  });
}

export function verifyBackup(run, jobs, proof, {id, parent}) {
  verifyRun(run, {repo: backend, path: backupWorkflow, id});
  requireCheck(run.actor?.login === 'hakaru4i-afk' && run.display_title === 'Production backup ' + parent, 'BACKUP_PARENT_RUN_MISMATCH');
  requireCheck(Array.isArray(jobs?.jobs) && jobs.total_count === jobs.jobs.length && jobs.jobs.some(job =>
    job.name === 'capture-and-readback' && job.status === 'completed' && job.conclusion === 'success' &&
    job.labels?.some(label => label === 'freight-mac-backup-vm' || label === 'ubuntu-latest' || label.startsWith('ubuntu-'))),
  'PROTECTED_CAPTURE_NOT_COMPLETED');
  const restore = proof?.proof;
  requireCheck(proof?.result === 'PASS_CAPTURE_PAYLOAD_RESTORE_AND_CIPHERTEXT_READBACK' && proof.encrypted === true &&
    proof.offsiteReadback === true && sha64.test(proof.ciphertextSha256) &&
    restore?.ciphertextSha256 === proof.ciphertextSha256 && restore.databaseRestored === true &&
    restore.storageBytesRestored === true && restore.isolationVerified === true &&
    restore.sourceCredentialsForwarded === false && restore.ciphertextDecryptionVerified === true &&
    restore.verificationRecipientDestroyed === true, 'BACKUP_OR_RESTORE_PROOF_INVALID');
}

export function waitingForBackupGuest(result) {
  const jobs = result?.jobs;
  if (!Array.isArray(jobs) || result.total_count !== jobs.length) return false;
  return jobs.some(job => ['protected-readiness', 'capture-and-readback'].includes(job.name) &&
    job.status === 'queued' && !job.runner_name) &&
    !jobs.some(job => job.name === 'capture-and-readback' && (job.runner_name || job.status === 'completed'));
}

async function dispatchBackup(env) {
  const parent = env.GITHUB_RUN_ID;
  const token = env.BACKEND_RELEASE_TOKEN;
  requireCheck(validId(parent), 'INVALID_PARENT_RELEASE_RUN');
  const repository = 'repos/' + backend;
  const runPath = repository + '/actions/runs/';
  // Match the current main source, including the protected workflow with the automatic input.
  const trustedWorkflowSha = ghJson(repository + '/git/ref/heads/main', token).object?.sha;
  requireCheck(sha40.test(trustedWorkflowSha), 'BACKUP_WORKFLOW_SHA_UNAVAILABLE');
  const pause = () => new Promise(done => setTimeout(done, 15000));
  const deadline = Date.now() + 85 * 60 * 1000;
  const launch = runner => {
    const request = {ref: 'main', return_run_details: true, inputs: {operation: 'capture', release_run: parent, runner}};
    const result = ghJson(repository + '/actions/workflows/' + backupWorkflow + '/dispatches', token, {
      args: ['--method', 'POST', '--input', '-'], input: JSON.stringify(request)
    });
    requireCheck(validId(result.workflow_run_id), 'BACKUP_DISPATCH_RUN_ID_MISSING');
    console.log('Backup run ' + result.workflow_run_id + ' queued for release ' + parent + ' using ' + runner);
    return result.workflow_run_id;
  };
  const getRun = id => {
    const run = ghJson(runPath + id, token);
    requireCheck(run.head_sha === trustedWorkflowSha && run.display_title === 'Production backup ' + parent,
      'BACKUP_DISPATCH_IDENTITY_CHANGED');
    return run;
  };
  const getJobs = id => ghJson(runPath + id + '/jobs?per_page=100', token);
  let runner = 'mac';
  let id = launch(runner);
  let waitingSince = null;
  let run = getRun(id);
  while (run.status !== 'completed' && Date.now() < deadline) {
    if (runner === 'mac') {
      const unattended = waitingForBackupGuest(getJobs(id));
      waitingSince = unattended ? waitingSince ?? Date.now() : null;
      if (waitingSince !== null && Date.now() - waitingSince >= 120000 && waitingForBackupGuest(getJobs(id))) {
        // No capture has started. Cancel only our own backup request before reusing the protected queue.
        gh(['run', 'cancel', String(id), '--repo', backend], token);
        const cancellationDeadline = Date.now() + 90000;
        do {
          await pause();
          run = getRun(id);
        } while (run.status !== 'completed' && Date.now() < cancellationDeadline);
        requireCheck(run.status === 'completed' && run.conclusion === 'cancelled', 'MAC_BACKUP_CANCELLATION_UNCONFIRMED');
        runner = 'github';
        id = launch(runner);
      }
    }
    await pause();
    run = getRun(id);
  }
  requireCheck(run.status === 'completed' && run.conclusion === 'success', 'FRESH_AUTOMATIC_BACKUP_FAILED_OR_TIMED_OUT');
  const jobs = getJobs(id);
  const job = jobs.jobs?.find(entry => entry.name === 'capture-and-readback');
  requireCheck(validId(job?.id), 'BACKUP_CAPTURE_JOB_MISSING');
  const log = gh(['api', repository + '/actions/jobs/' + job.id + '/logs'], token);
  const markers = log.split('\n').filter(line => / CAPTURE_RESTORE_PROOF \{/.test(line));
  requireCheck(markers.length === 1, 'BACKUP_RESTORE_PROOF_MISSING');
  const proof = JSON.parse(markers[0].slice(markers[0].indexOf(' CAPTURE_RESTORE_PROOF ') + ' CAPTURE_RESTORE_PROOF '.length));
  verifyBackup(run, jobs, proof, {id, parent});
  console.log('Fresh backup, ciphertext readback and isolated restore verified.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const env = process.env;
    const lock = readLock();
    switch (process.argv[2]) {
      case 'plan':
        console.log(JSON.stringify({...lock, function: targetFunction(lock), releaseVersion: nextVersion((await readCurrentSite()).businessVersion)}));
        break;
      case 'evidence':
        requireCheck(env.RELEASE_APPROVAL === approval(lock), 'OWNER_APPROVAL_FOR_EXACT_LOCK_REQUIRED');
        fetchEvidence(lock, env);
        break;
      case 'backup':
        await dispatchBackup(env);
        break;
      default:
        throw Error('INVALID_RELEASE_COMMAND');
    }
  } catch (error) {
    console.error(String(error.message).match(/^[A-Z0-9_:.-]+$/) ? error.message : 'LOCKED_RELEASE_PREFLIGHT_FAILED');
    process.exitCode = 1;
  }
}
