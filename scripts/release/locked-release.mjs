import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const web = 'hakaru4i-afk/freight-quotes-web';
export const backend = 'hakaru4i-afk/freight-quotes';
export const project = 'ooclsrndeygojtofuyte';
export const site = 'https://hakaru4i-afk.github.io/freight-quotes-web/';
export const stagingUrl = new URL('test/', site).href;
export const qaProject = 'ibclzdkxiozbzmniiygv';
export const qaRun = 'rc20261110';
export const qaFunction = 'freight-api-qa-' + qaRun;
const maxEvidenceAge = 24 * 60 * 60 * 1000;
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
  const {captureStderr = false, ...commandOptions} = opts;
  return execFileSync('gh', args, {
    ...commandOptions, env: {...process.env, GH_TOKEN: token}, encoding: 'utf8',
    stdio: [commandOptions.input ? 'pipe' : 'ignore', 'pipe', captureStderr ? 'pipe' : 'ignore'],
    timeout: 60000, maxBuffer: 8 * 1024 * 1024
  });
}

export const ghJson = (path, token, opts) => JSON.parse(gh(['api', path, ...opts?.args ?? []], token, opts));
export const validId = id => /^[1-9][0-9]*$/.test(String(id)) && Number.isSafeInteger(Number(id));

function verifyRun(run, {repo, path, id, sha}) {
  requireCheck(run?.id === Number(id) && run.repository?.full_name === repo && run.path === '.github/workflows/' + path &&
    run.head_branch === 'main' && (!sha || run.head_sha === sha) && run.event === 'workflow_dispatch' &&
    run.status === 'completed' && run.conclusion === 'success', 'RELEASE_PROOF_RUN_MISMATCH:' + path);
}

export function requireFreshTime(value, start, end) {
  const time = Date.parse(value);
  requireCheck(Number.isFinite(time) && time >= start && time <= end, 'RELEASE_EVIDENCE_TIME_MISMATCH');
}

export function verifyRunReceipt(lock, kind, receipt, run) {
  requireCheck(receipt?.kind === kind && receipt.frontendSha === lock.frontendSha &&
    receipt.backendSha === lock.backendSha && receipt.runId === String(run.id) &&
    receipt.attempt === String(run.run_attempt) && receipt.workflowSha === run.head_sha,
  'RELEASE_RUN_RECEIPT_MISMATCH:' + kind);
  requireFreshTime(receipt.generatedAt, Date.parse(run.run_started_at), Date.parse(run.updated_at));
}


export const evidenceWorkflows = {
  frontend: {path: 'release-stabilization.yml', jobs: ['lock', 'regression', 'complete-regression'], artifact: 'locked-frontend-regression'},
  backend: {path: 'locked-backend-regression.yml', jobs: ['regression', 'backup-safety', 'schema-transition'], artifact: 'locked-backend-regression'},
  e2e: {path: 'isolated-qa-oidc-browser.yml', jobs: ['real-qa'], artifact: 'locked-release-evidence'}
};

export function verifyEvidenceRun(kind, run, jobs, artifacts, id, now = Date.now()) {
  const {path, jobs: required, artifact} = evidenceWorkflows[kind];
  verifyRun(run, {repo: web, path, id});
  requireCheck(run.head_repository?.full_name === web && sha40.test(run.head_sha) &&
    run.actor?.login === 'hakaru4i-afk' && run.triggering_actor?.login === 'hakaru4i-afk' &&
    validId(run.run_attempt), 'UNTRUSTED_RELEASE_PROOF_RUN:' + kind);
  requireFreshTime(run.run_started_at, now - maxEvidenceAge, now);
  requireFreshTime(run.updated_at, Date.parse(run.run_started_at), now);
  requireCheck(Array.isArray(jobs?.jobs) && jobs.total_count === jobs.jobs.length && required.every(name => jobs.jobs.filter(job =>
    job.name === name && job.run_attempt === run.run_attempt &&
    job.status === 'completed' && job.conclusion === 'success').length === 1), 'REQUIRED_RELEASE_JOB_NOT_PASSED');
  const label = artifact + '-attempt-' + run.run_attempt;
  const matches = artifacts?.artifacts?.filter(item => item.name === label);
  requireCheck(Array.isArray(artifacts?.artifacts) && artifacts.total_count === artifacts.artifacts.length && matches?.length === 1 &&
    validId(matches[0].id) && matches[0].expired === false && Date.parse(matches[0].expires_at) > now,
  'RELEASE_PROOF_ARTIFACT_MISSING_OR_EXPIRED:' + kind);
  requireFreshTime(matches[0].created_at, Date.parse(run.run_started_at), Date.parse(run.updated_at));
  return label;
}

export function verifyRegressionReceipt(lock, kind, receipt, run, bytes) {
  verifyRunReceipt(lock, kind, receipt, run);
  const expected = kind === 'frontend' ? lock.frontendSha : lock.backendSha;
  requireCheck(receipt.sourceSha === expected && receipt.reportSha256 === digest(bytes), 'REGRESSION_SOURCE_OR_REPORT_MISMATCH:' + kind);
}

// A dispatch can run a newer workflow than the immutable candidate it tests.
export function findEvidenceRun(lock, runs, readRunLock, now = Date.now()) {
  const recent = runs.filter(run => run.head_branch === 'main' && run.event === 'workflow_dispatch' &&
    run.actor?.login === 'hakaru4i-afk' && sha40.test(run.head_sha) && validId(run.id) &&
    Date.parse(run.run_started_at) >= now - maxEvidenceAge && Date.parse(run.run_started_at) <= now);
  const runLocks = new Map();
  for (const run of recent.sort((a, b) => Date.parse(b.run_started_at) - Date.parse(a.run_started_at) || b.id - a.id)) {
    if (!runLocks.has(run.head_sha)) runLocks.set(run.head_sha, readRunLock(run.head_sha));
    const candidate = runLocks.get(run.head_sha);
    if (candidate?.frontendSha === lock.frontendSha && candidate?.backendSha === lock.backendSha) return run.id;
  }
  return null;
}

export function verifyE2eReceipt(lock, pair, e2eBytes, run, backendReceipt) {
  verifyRunReceipt(lock, 'e2e', pair, run);
  const e2e = JSON.parse(e2eBytes);
  requireCheck(e2e.runId === pair.runId && e2e.attempt === pair.attempt && e2e.workflowSha === pair.workflowSha,
    'E2E_REPORT_RUN_MISMATCH');
  requireCheck(Array.isArray(e2e.scenarios) && e2e.scenarios.every(scenario => {
    const evidence = scenario.evidence;
    return Array.isArray(evidence?.sources) &&
      evidence.sources.every(source => sha64.test(source.sha256)) &&
      evidence.sources.some(source => /^.+\/browser-results-.+\.json$/.test(source.file)) &&
      evidence.traceId === digest(JSON.stringify(evidence.sources));
  }), 'E2E_SCENARIO_RECEIPT_MISMATCH');
  const usesInputReceipt = pair.qaInputSha256 !== undefined || backendReceipt.qaInputSha256 !== undefined;
  const packageMatches = usesInputReceipt
    ? sha64.test(pair.qaInputSha256) && pair.qaInputSha256 === backendReceipt.qaInputSha256
    : pair.qaEntrySha256 === backendReceipt.qaEntrySha256;
  requireCheck(pair.e2eReportSha256 === digest(e2eBytes) &&
    pair.stagingUrl === stagingUrl && pair.qaProject === qaProject && pair.apiFunction === qaFunction && validId(pair.apiVersion) &&
    packageMatches && sha64.test(pair.qaEntrySha256) &&
    sha64.test(pair.servedIndexSha256) && sha64.test(pair.servedAppSha256), 'E2E_RUNTIME_RECEIPT_MISMATCH');
}

function fetchEvidence(lock, env) {
  const token = env.WEB_TOKEN;
  const root = mkdtempSync(resolve(env.RUNNER_TEMP, 'locked-candidate-evidence-'));
  try {
    const runs = {};
    for (const [kind, workflow] of Object.entries(evidenceWorkflows)) {
      const given = env[kind.toUpperCase() + '_RUN_ID'];
      const id = given || findEvidenceRun(lock, ghJson('repos/' + web + '/actions/workflows/' + workflow.path +
        '/runs?branch=main&event=workflow_dispatch&per_page=30', token).workflow_runs, sha => {
        const file = ghJson('repos/' + web + '/contents/release-lock.json?ref=' + sha, token);
        requireCheck(file.encoding === 'base64' && typeof file.content === 'string', 'EVIDENCE_SOURCE_LOCK_UNAVAILABLE');
        return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      });
      requireCheck(validId(id), 'FRESH_EXACT_PAIR_RUN_NOT_FOUND:' + kind);
      const base = 'repos/' + web + '/actions/runs/' + id;
      const run = ghJson(base, token);
      requireCheck(validId(run.run_attempt), 'INVALID_RELEASE_PROOF_ATTEMPT');
      const jobs = ghJson(base + '/attempts/' + run.run_attempt + '/jobs?per_page=100', token);
      const artifacts = ghJson(base + '/artifacts?per_page=100', token);
      const artifactName = verifyEvidenceRun(kind, run, jobs, artifacts, id);
      gh(['run', 'download', id, '--repo', web, '--name', artifactName, '--dir', resolve(root, kind)], token);
      const current = ghJson(base, token);
      requireCheck(current.run_attempt === run.run_attempt && current.status === 'completed' &&
        current.conclusion === 'success', 'RELEASE_PROOF_RUN_CHANGED:' + kind);
      runs[kind] = run;
    }
    const bytes = (kind, name) => {
      const files = readdirSync(resolve(root, kind), {withFileTypes: true});
      requireCheck(files.some(file => file.isFile() && file.name === name), 'RELEASE_EVIDENCE_FILE_MISSING:' + name);
      return readFileSync(resolve(root, kind, name));
    };
    const read = (kind, name) => JSON.parse(bytes(kind, name));
    const regression = bytes('frontend', 'task12-robot-matrix.json');
    const security = bytes('backend', 'schema-transition-rehearsal.json');
    const backendReceipt = read('backend', 'run-receipt.json');
    const pair = read('e2e', 'release-gate-pair.json');
    const e2e = bytes('e2e', 'private-authenticated-e2e.json');
    verifyRegressionReceipt(lock, 'frontend', read('frontend', 'run-receipt.json'), runs.frontend, regression);
    verifyRegressionReceipt(lock, 'backend', backendReceipt, runs.backend, security);
    verifyE2eReceipt(lock, pair, e2e, runs.e2e, backendReceipt);
    verifyCandidateEvidence(lock, {pair, regression: JSON.parse(regression), security: JSON.parse(security), e2e: JSON.parse(e2e)});
    return Object.fromEntries(Object.entries(runs).map(([kind, run]) => [kind, {
      runId: String(run.id), attempt: String(run.run_attempt), workflowSha: run.head_sha
    }]));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

export function verifyBackup(run, jobs, proof, {id, parent}) {
  verifyRun(run, {repo: backend, path: backupWorkflow, id});
  requireCheck(run.actor?.login === 'hakaru4i-afk' && run.triggering_actor?.login === 'hakaru4i-afk' && validId(run.run_attempt) &&
    run.display_title === 'Production backup ' + parent, 'BACKUP_PARENT_RUN_MISMATCH');
  requireCheck(Array.isArray(jobs?.jobs) && jobs.total_count === jobs.jobs.length && jobs.jobs.some(job =>
    job.name === 'capture-and-readback' && job.run_attempt === run.run_attempt && job.status === 'completed' && job.conclusion === 'success' &&
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

export function currentBackupRun(runs, parent, workflowSha) {
  requireCheck(Array.isArray(runs), 'BACKUP_RUN_INVENTORY_MISSING');
  const matching = runs.filter(run => run.display_title === 'Production backup ' + parent && run.conclusion !== 'cancelled');
  requireCheck(matching.length <= 1, 'DUPLICATE_RELEASE_BOUND_BACKUP_RUNS');
  if (!matching.length) return null;
  const [run] = matching;
  requireCheck(run.head_sha === workflowSha && validId(run.id) && run.event === 'workflow_dispatch' && run.head_branch === 'main' &&
    run.actor?.login === 'hakaru4i-afk', 'UNTRUSTED_EXISTING_RELEASE_BACKUP');
  return run;
}

export function waitingForBackupGuest(result) {
  const jobs = result?.jobs;
  if (!Array.isArray(jobs) || result.total_count !== jobs.length) return false;
  return jobs.some(job => ['protected-readiness', 'capture-and-readback'].includes(job.name) &&
    job.status === 'queued' && !job.runner_name) &&
    !jobs.some(job => job.name === 'capture-and-readback' && (job.runner_name || job.status === 'completed'));
}

function backupGithubJson(phase, path, token, opts = {}) {
  requireCheck(token, 'RELEASE_GITHUB_CREDENTIAL_UNAVAILABLE');
  const prefix = 'BACKUP_GITHUB_' + phase + '_';
  let output;
  try {
    output = gh(['api', path, ...opts.args ?? []], token, {...opts, captureStderr: true});
  } catch (error) {
    // Only the HTTP status is safe to report. The command and response can contain private data.
    const status = /^gh: [^\r\n]*\(HTTP ([45]\d{2})\)\r?$/m.exec(error.stderr ?? '')?.[1];
    throw Error(prefix + (status ? 'HTTP_' + status : 'COMMAND_FAILED'));
  }
  try {
    return JSON.parse(output);
  } catch {
    throw Error(prefix + 'INVALID_JSON');
  }
}

// Job logs are a short-lived signed HTTPS redirect, not a JSON API response.
export async function downloadBackupJobLog(jobId, token, fetcher = fetch, pause = ms => new Promise(done => setTimeout(done, ms))) {
  requireCheck(validId(jobId), 'BACKUP_CAPTURE_JOB_MISSING');
  requireCheck(token, 'RELEASE_GITHUB_CREDENTIAL_UNAVAILABLE');
  let code = 'BACKUP_GITHUB_LOG_TRANSPORT_FAILED';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetcher('https://api.github.com/repos/' + backend + '/actions/jobs/' + jobId + '/logs', {
        headers: {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
        redirect: 'manual', signal: AbortSignal.timeout(30000)
      });
      if (response.status !== 302) {
        code = 'BACKUP_GITHUB_LOG_HTTP_' + response.status;
        if (![404, 429, 500, 502, 503, 504].includes(response.status)) break;
      } else {
        const location = response.headers.get('location');
        let url;
        try { url = new URL(location); } catch { throw Error('BACKUP_GITHUB_LOG_REDIRECT_INVALID'); }
        requireCheck(url.protocol === 'https:' && !url.username && !url.password, 'BACKUP_GITHUB_LOG_REDIRECT_INVALID');
        // Never forward the repository token to the signed download host.
        const download = await fetcher(url.href, {redirect: 'error', signal: AbortSignal.timeout(60000)});
        if (download.ok) return await download.text();
        code = 'BACKUP_GITHUB_LOG_DOWNLOAD_HTTP_' + download.status;
      }
    } catch (error) {
      if (error.message === 'BACKUP_GITHUB_LOG_REDIRECT_INVALID') throw error;
      code = 'BACKUP_GITHUB_LOG_TRANSPORT_FAILED';
    }
    if (attempt < 3) await pause(2000 * (attempt + 1));
  }
  throw Error(code);
}

export function parseBackupRestoreProof(log) {
  const markers = log.split('\n').filter(line => /^\d{4}-\d\d-\d\dT\S+ CAPTURE_RESTORE_PROOF \{/.test(line));
  requireCheck(markers.length === 1, 'BACKUP_RESTORE_PROOF_MISSING');
  try {
    return JSON.parse(markers[0].slice(markers[0].indexOf(' CAPTURE_RESTORE_PROOF ') + ' CAPTURE_RESTORE_PROOF '.length));
  } catch {
    throw Error('BACKUP_RESTORE_PROOF_INVALID_JSON');
  }
}

// Dispatch returns an ID before all run metadata is necessarily visible.
// Wait for the exact identity; never act on or accept an unverified run.
export async function waitForBackupRunIdentity(readRun, {id, parent, workflowSha}, pause = ms => new Promise(done => setTimeout(done, ms))) {
  requireCheck(validId(id) && validId(parent) && sha40.test(workflowSha), 'BACKUP_DISPATCH_IDENTITY_INPUT_INVALID');
  for (let attempt = 0; attempt < 7; attempt++) {
    let run;
    try {
      run = readRun(id);
    } catch (error) {
      if (!/^BACKUP_GITHUB_RUN_READBACK_HTTP_(404|429|500|502|503|504)$/.test(error.message)) throw error;
      if (attempt === 6) throw error;
    }
    if (run?.id === Number(id) && run.head_sha === workflowSha && run.display_title === 'Production backup ' + parent &&
      run.repository?.full_name === backend && run.path === '.github/workflows/' + backupWorkflow &&
      run.head_branch === 'main' && run.event === 'workflow_dispatch' && run.actor?.login === 'hakaru4i-afk') return run;
    if (attempt < 6) await pause(5000);
  }
  throw Error('BACKUP_DISPATCH_IDENTITY_CHANGED');
}

async function dispatchBackup(env) {
  const parent = env.GITHUB_RUN_ID;
  const token = env.BACKEND_RELEASE_TOKEN;
  requireCheck(validId(parent), 'INVALID_PARENT_RELEASE_RUN');
  const repository = 'repos/' + backend;
  const runPath = repository + '/actions/runs/';
  // Match the current main source, including the protected workflow with the automatic input.
  const trustedWorkflowSha = backupGithubJson('MAIN_REF', repository + '/git/ref/heads/main', token)?.object?.sha;
  requireCheck(sha40.test(trustedWorkflowSha), 'BACKUP_WORKFLOW_SHA_UNAVAILABLE');
  const pause = () => new Promise(done => setTimeout(done, 15000));
  const deadline = Date.now() + 85 * 60 * 1000;
  const launch = runner => {
    const request = {ref: 'main', return_run_details: true, inputs: {operation: 'capture', release_run: parent, runner}};
    const result = backupGithubJson('DISPATCH', repository + '/actions/workflows/' + backupWorkflow + '/dispatches', token, {
      args: ['--method', 'POST', '--input', '-'], input: JSON.stringify(request)
    });
    requireCheck(validId(result?.workflow_run_id), 'BACKUP_DISPATCH_RUN_ID_MISSING');
    console.log('Backup run ' + result.workflow_run_id + ' queued for release ' + parent + ' using ' + runner);
    return result.workflow_run_id;
  };
  const getRun = id => waitForBackupRunIdentity(
    runId => backupGithubJson('RUN_READBACK', runPath + runId, token),
    {id, parent, workflowSha: trustedWorkflowSha}
  );
  const getJobs = run => backupGithubJson('JOB_INVENTORY', runPath + run.id + '/attempts/' + run.run_attempt + '/jobs?per_page=100', token);
  const previous = currentBackupRun(backupGithubJson('RUN_INVENTORY', repository + '/actions/workflows/' + backupWorkflow +
    '/runs?event=workflow_dispatch&branch=main&per_page=100', token)?.workflow_runs, parent, trustedWorkflowSha);
  let runner = previous ? null : 'mac';
  let id = previous?.id ?? launch(runner);
  let waitingSince = null;
  let run = await getRun(id);
  while (run.status !== 'completed' && Date.now() < deadline) {
    if (runner === 'mac') {
      const unattended = waitingForBackupGuest(getJobs(run));
      waitingSince = unattended ? waitingSince ?? Date.now() : null;
      if (waitingSince !== null && Date.now() - waitingSince >= 120000 && waitingForBackupGuest(getJobs(run))) {
        // No capture has started. Cancel only our own backup request before reusing the protected queue.
        gh(['run', 'cancel', String(id), '--repo', backend], token);
        const cancellationDeadline = Date.now() + 90000;
        do {
          await pause();
          run = await getRun(id);
        } while (run.status !== 'completed' && Date.now() < cancellationDeadline);
        requireCheck(run.status === 'completed' && run.conclusion === 'cancelled', 'MAC_BACKUP_CANCELLATION_UNCONFIRMED');
        runner = 'github';
        id = launch(runner);
      }
    }
    await pause();
    run = await getRun(id);
  }
  requireCheck(run.status === 'completed' && run.conclusion === 'success', 'FRESH_AUTOMATIC_BACKUP_FAILED_OR_TIMED_OUT');
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Minsk'});
  requireFreshTime(run.run_started_at, Date.now() - maxEvidenceAge, Date.now());
  requireCheck(today.format(new Date(run.run_started_at)) === today.format(new Date()), 'PRODUCTION_BACKUP_NOT_FROM_RELEASE_DAY');
  const jobs = getJobs(run);
  const job = jobs.jobs?.find(entry => entry.name === 'capture-and-readback');
  requireCheck(validId(job?.id), 'BACKUP_CAPTURE_JOB_MISSING');
  const proof = parseBackupRestoreProof(await downloadBackupJobLog(job.id, token));
  verifyBackup(run, jobs, proof, {id, parent});
  return {runId: String(id), attempt: String(run.run_attempt), ciphertextSha256: proof.ciphertextSha256};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const env = process.env;
    const lock = readLock();
    switch (process.argv[2]) {
      case 'plan': {
        const current = await readCurrentSite();
        requireCheck(current.frontendSourceCommit !== lock.frontendSha || current.backendSourceCommit !== lock.backendSha,
          'EXACT_PAIR_ALREADY_SERVED_VERIFY_PRODUCTION');
        console.log(JSON.stringify({...lock, function: targetFunction(lock), releaseVersion: nextVersion(current.businessVersion)}));
        break;
      }
      case 'evidence':
        requireCheck(env.RELEASE_APPROVAL === approval(lock), 'OWNER_APPROVAL_FOR_EXACT_LOCK_REQUIRED');
        console.log(JSON.stringify(fetchEvidence(lock, env)));
        break;
      case 'backup': {
        const receipt = JSON.stringify(await dispatchBackup(env));
        if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, 'receipt=' + receipt + '\n');
        console.log(receipt);
        break;
      }
      default:
        throw Error('INVALID_RELEASE_COMMAND');
    }
  } catch (error) {
    console.error(String(error.message).match(/^[A-Z0-9_:.-]+$/) ? error.message : 'LOCKED_RELEASE_PREFLIGHT_FAILED');
    process.exitCode = 1;
  }
}
