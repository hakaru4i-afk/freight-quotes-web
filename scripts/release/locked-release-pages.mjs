import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest, nextVersion, project, readCurrentSite, readLock, requireCheck, sha40, sha64, site, targetFunction, validId} from './locked-release.mjs';
import {readSchemaVersion} from './locked-release-api.mjs';
import {readFiles, captureRoot, rootInventory, stagingFiles} from './locked-pages-assets.mjs';
export {readFiles} from './locked-pages-assets.mjs';

const legacyApi = 'https://' + project + '.supabase.co/functions/v1/freight-api';
const manifestName = 'production-release-manifest.json';
const feedbackScript = 'portal-feedback-center-20261107.js';
const htmlAssets = html => [...html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g)].map(match => match[1]);

export function validateApiProof(lock, proof, releaseVersion) {
  requireCheck(proof?.frontendSha === lock.frontendSha && proof.backendSha === lock.backendSha &&
    proof.apiFunction === targetFunction(lock) && proof.releaseVersion === releaseVersion &&
    Number.isSafeInteger(proof.apiVersion) && proof.apiVersion > 0 && sha64.test(proof.apiBundleSha256),
  'PAGES_REQUIRES_VERIFIED_EXACT_API');
}

export function publicationRecord(proof, actions, evidence, backup) {
  requireCheck(new RegExp('^' + project + '_[a-f0-9-]{36}_' + proof.apiVersion + '$').test(proof.apiDeploymentId) &&
    /^\d{14}$/.test(proof.schemaVersion), 'PRODUCTION_API_OR_SCHEMA_RECEIPT_MISSING');
  const validRun = run => validId(run?.runId) && validId(run.attempt);
  requireCheck(validRun(actions) && sha40.test(actions.workflowSha) && validRun(backup) && sha64.test(backup.ciphertextSha256) &&
    ['frontend', 'backend', 'e2e'].every(kind => validRun(evidence?.[kind]) && sha40.test(evidence[kind].workflowSha)),
  'PRODUCTION_ACTION_RECEIPTS_MISSING');
  return {actions, evidence, backup: {runId: backup.runId, attempt: backup.attempt}};
}

export function bindPages(files, lock, proof, baseline, currentStatus, publication, now = new Date()) {
  const releaseVersion = nextVersion(baseline.businessVersion);
  validateApiProof(lock, proof, releaseVersion);
  requireCheck(currentStatus?.release?.version === baseline.businessVersion && Array.isArray(currentStatus.releases),
    'CURRENT_RELEASE_HISTORY_MISMATCH');
  const build = digest(lock.frontendSha + lock.backendSha + releaseVersion).slice(0, 20);
  const read = name => files.get(name).toString('utf8');
  const readJson = name => JSON.parse(read(name));
  const set = (name, content) => files.set(name, Buffer.from(typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n'));
  const app = read('app.js');
  const apiPattern = /https:\/\/ooclsrndeygojtofuyte\.supabase\.co\/functions\/v1\/freight-api(?:-release-[a-f0-9]{32})?(?=["'])/g;
  requireCheck([...app.matchAll(apiPattern)].length === 1, 'FRONTEND_API_BINDING_AMBIGUOUS');
  requireCheck([...app.matchAll(/currentVersion:"[a-f0-9]{20}"/g)].length === 1, 'FRONTEND_BUILD_MARKER_AMBIGUOUS');
  set('app.js', app.replace(apiPattern, legacyApi.replace(/freight-api$/, () => proof.apiFunction))
    .replace(/currentVersion:"[a-f0-9]{20}"/g, 'currentVersion:"' + build + '"'));
  let html = read('index.html');
  requireCheck([...html.matchAll(/app\.js\?v=[a-f0-9]{12,40}/g)].length === 1, 'FRONTEND_CACHE_KEY_AMBIGUOUS');
  html = html.replace(/app\.js\?v=[a-f0-9]{12,40}/g, 'app.js?v=' + build)
    .replace(/(portal-release-status-[^"?'\s]+\.js\?v=)[^"'&\s]+/g, '$1' + encodeURIComponent(releaseVersion));
  const feedback = files.get('test/' + feedbackScript);
  requireCheck(feedback && files.has(feedbackScript), 'REVIEWED_OWNER_FEEDBACK_SCRIPT_MISSING');
  const feedbackCache = /(portal-feedback-center-20261107\.js\?v=)[a-f0-9]{12,40}/g;
  requireCheck([...html.matchAll(feedbackCache)].length === 1, 'OWNER_FEEDBACK_CACHE_KEY_AMBIGUOUS');
  files.set(feedbackScript, feedback);
  html = html.replace(feedbackCache, (_, path) => path + digest(feedback).slice(0, 12));
  set('index.html', html);
  for (const [path, prefix] of [['index.html', ''], ['test/index.html', 'test/']]) {
    for (const name of htmlAssets(read(path))) {
      requireCheck(files.has(prefix + name), 'MISSING_HTML_ASSET:' + prefix + name);
    }
  }

  const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Minsk'}).format(now);
  const record = {version: releaseVersion, date, title: 'Обновление Freight Quotes', changes: []};
  set('build-info.json', {...readJson('build-info.json'), environment: 'production', projectRef: project,
    releaseVersion, releaseDate: date, version: build, build, releaseStatus: 'PUBLISHED',
    frontendSourceCommit: lock.frontendSha, backendSourceCommit: lock.backendSha, backendApiVersion: proof.apiVersion,
    backendApiBundleSha256: proof.apiBundleSha256, apiFunction: proof.apiFunction});
  set('release-status.json', {...readJson('release-status.json'), version: releaseVersion, date, status: 'released', changes: []});
  set('site-status.json', {...currentStatus, environment: 'production', version: build, release: record,
    releases: [record, ...currentStatus.releases]});
  const manifest = {schemaVersion: 3, environment: 'production', publicationState: 'PUBLISHED',
    businessVersion: releaseVersion, frontendBuild: build, frontendSourceCommit: lock.frontendSha,
    backendSourceCommit: lock.backendSha, backendApiVersion: proof.apiVersion, apiFunction: proof.apiFunction,
    backendApiBundleSha256: proof.apiBundleSha256, apiDeploymentId: proof.apiDeploymentId,
    databaseSchemaVersion: proof.schemaVersion, publishedAt: now.toISOString(), ...publication,
    previous: {businessVersion: baseline.businessVersion, frontendBuild: baseline.frontendBuild,
      frontendSourceCommit: baseline.frontendSourceCommit, backendSourceCommit: baseline.backendSourceCommit,
      apiFunction: baseline.apiFunction},
    assets: Object.fromEntries([...files].filter(([path]) => path !== '.nojekyll').map(([path, data]) => [path, digest(data)]))};
  set(manifestName, manifest);
  return manifest;
}

async function currentHistory() {
  const response = await fetch(new URL('site-status.json?source=' + Date.now(), site), {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000)});
  requireCheck(response.ok, 'LIVE_RELEASE_HISTORY_UNAVAILABLE');
  return response.json();
}

export function assertPreservesEntrypoints(candidate, live) {
  const available = new Set(htmlAssets(candidate));
  for (const name of htmlAssets(live)) requireCheck(available.has(name), 'LOCKED_FRONTEND_OMITS_LIVE_ASSET:' + name);
}

async function liveIndex() {
  const response = await fetch(new URL('index.html?verify=' + Date.now(), site), {redirect: 'error', signal: AbortSignal.timeout(20000)});
  requireCheck(response.ok, 'LIVE_FRONTEND_HTML_UNAVAILABLE');
  return response.text();
}

async function verifyServed(expected) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  requireCheck(token, 'SUPABASE_RELEASE_CREDENTIAL_UNAVAILABLE');
  for (let i = 0; i < 20; i++) {
    try {
      const current = await readCurrentSite();
      requireCheck(JSON.stringify(current) === JSON.stringify(expected), 'PUBLISHED_PAIR_MISMATCH');
      const apiUrl = legacyApi.replace(/freight-api$/, () => expected.apiFunction);
      const [api, health, schemaVersion] = await Promise.all([
        fetch('https://api.supabase.com/v1/projects/' + project + '/functions/' + expected.apiFunction, {
          headers: {Authorization: 'Bearer ' + token}, redirect: 'error', signal: AbortSignal.timeout(12000)
        }),
        fetch(apiUrl + '/health', {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000)}),
        readSchemaVersion(token)
      ]);
      requireCheck(api.ok && health.ok, 'SERVED_API_METADATA_OR_HEALTH_UNAVAILABLE');
      const provider = await api.json();
      requireCheck(provider.slug === expected.apiFunction && provider.status === 'ACTIVE' &&
        provider.version === expected.backendApiVersion && provider.ezbr_sha256 === expected.backendApiBundleSha256 &&
        [project, provider.id, provider.version].join('_') === expected.apiDeploymentId,
      'SERVED_API_PROVIDER_DRIFT');
      const runtime = await health.json();
      requireCheck(runtime.ok === true && runtime.environment === 'production' && runtime.projectRef === project &&
        runtime.deploymentId === expected.apiDeploymentId && runtime.backendSha === expected.backendSourceCommit &&
        runtime.frontendSha === expected.frontendSourceCommit && schemaVersion === expected.databaseSchemaVersion,
        'SERVED_RUNTIME_OR_SCHEMA_DRIFT');
      await Promise.all(['index.html', 'app.js', 'style.css', feedbackScript, 'test/index.html', 'test/app.js', 'test/staging-manifest.json'].map(async file => {
        const response = await fetch(new URL(file + '?readback=' + Date.now(), site), {redirect: 'error', signal: AbortSignal.timeout(20000)});
        requireCheck(response.ok && digest(Buffer.from(await response.arrayBuffer())) === expected.assets[file],
          'PUBLISHED_ASSET_HASH_MISMATCH:' + file);
      }));
      break;
    } catch (error) {
      if (i === 19) throw error;
      await new Promise(done => setTimeout(done, 6000));
    }
  }
  const root = await captureRoot();
  requireCheck(JSON.stringify(JSON.parse(root.get(manifestName))) === JSON.stringify(expected), 'PUBLISHED_PAIR_CHANGED_DURING_READBACK');
}

function writePages(out, files) {
  mkdirSync(out);
  for (const [name, data] of files) {
    const target = join(out, name);
    mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, data);
  }
}

async function verifyRollback(out) {
  const root = await captureRoot();
  const expected = readFileSync(join(out, manifestName));
  requireCheck(root.get(manifestName).equals(expected), 'ROLLBACK_ROOT_NOT_RESTORED');
  const previous = JSON.parse(expected);
  const apiFunction = previous.apiFunction ?? 'freight-api';
  requireCheck(/^freight-api(?:-release-[a-f0-9]{32})?$/.test(apiFunction), 'ROLLBACK_API_FUNCTION_INVALID');
  const health = await fetch(legacyApi.replace(/freight-api$/, () => apiFunction) + '/health', {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  requireCheck(health.ok, 'ROLLBACK_API_HEALTH_FAILED');
  const runtime = await health.json();
  requireCheck(runtime.ok === true && runtime.projectRef === project && runtime.environment === 'production' &&
    (!previous.apiDeploymentId || runtime.deploymentId === previous.apiDeploymentId), 'ROLLBACK_API_HEALTH_FAILED');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [mode, source, out, proofPath] = process.argv.slice(2);
    if (mode === 'verify') {
      await verifyServed(JSON.parse(readFileSync(join(out, manifestName), 'utf8')));
    } else if (mode === 'verify-rollback') {
      await verifyRollback(out);
    } else {
      const lock = readLock();
      const checkedOut = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
      requireCheck(checkedOut === lock.frontendSha, 'PAGES_CHECKOUT_DOES_NOT_MATCH_RELEASE_LOCK');
      requireCheck(!execFileSync('git', ['-C', source, 'status', '--porcelain', '--untracked-files=no'], {encoding: 'utf8'}).trim(), 'PAGES_SOURCE_MODIFIED');
      const files = readFiles(source);
      if (mode !== 'offline') assertPreservesEntrypoints(files.get('index.html').toString('utf8'), await liveIndex());
      if (mode === 'package') {
        const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
        const [baseline, status] = await Promise.all([readCurrentSite(), currentHistory()]);
        const snapshot = JSON.parse(readFileSync(join(process.env.RELEASE_ROLLBACK_PATH, manifestName), 'utf8'));
        requireCheck(JSON.stringify(snapshot) === JSON.stringify(baseline), 'PRODUCTION_CHANGED_AFTER_ROLLBACK_SNAPSHOT');
        const actions = {runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, workflowSha: process.env.GITHUB_SHA};
        const publication = publicationRecord(proof, actions, JSON.parse(process.env.RELEASE_EVIDENCE), JSON.parse(process.env.RELEASE_BACKUP));
        const manifest = bindPages(files, lock, proof, baseline, status, publication);
        rootInventory(manifest);
        writePages(out, files);
      } else if (mode === 'snapshot') {
        writePages(out, [...await captureRoot(), ...stagingFiles(source), ['.nojekyll', Buffer.alloc(0)]]);
      } else {
        requireCheck(mode === 'preflight' || mode === 'offline', 'INVALID_PAGES_RELEASE_COMMAND');
        console.log(files.size + ' frontend files from the locked commit are available.');
      }
    }
  } catch (error) {
    console.error(String(error.message).match(/^[A-Z0-9_:./-]+$/) ? error.message : 'LOCKED_PAGES_BUILD_FAILED');
    process.exitCode = 1;
  }
}
