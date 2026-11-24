import {execFileSync} from 'node:child_process';
import {lstatSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest, nextVersion, project, readCurrentSite, readLock, requireCheck, sha64, site, targetFunction} from './locked-release.mjs';

const staticFile = /\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
const publicDirs = new Set(['test', 'global-view', 'processes', 'process-history']);
const exclude = /(?:^|\/)(?:node_modules|reports|scripts|tests|docs|config|release|verified)(?:\/|$)|(?:^|[-_.])(?:secret|private-key|credential|session-token|password|database-url)(?:[-_.]|$)/i;
const legacyApi = 'https://' + project + '.supabase.co/functions/v1/freight-api';
const manifestName = 'production-release-manifest.json';
const htmlAssets = html => [...html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g)].map(match => match[1]);

export function validateApiProof(lock, proof, releaseVersion) {
  requireCheck(proof?.frontendSha === lock.frontendSha && proof.backendSha === lock.backendSha &&
    proof.apiFunction === targetFunction(lock) && proof.releaseVersion === releaseVersion &&
    Number.isSafeInteger(proof.apiVersion) && proof.apiVersion > 0 && sha64.test(proof.apiBundleSha256),
  'PAGES_REQUIRES_VERIFIED_EXACT_API');
}

export function readFiles(source) {
  const indexed = execFileSync('git', ['-C', source, 'ls-files', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean);
  const files = new Map();
  for (const name of indexed) {
    const parts = name.split('/');
    if (name !== '.nojekyll' && (parts.some(part => part.startsWith('.')) || exclude.test(name) || !staticFile.test(name) ||
        (parts.length > 1 && !publicDirs.has(parts[0])) || ['release-lock.json', manifestName].includes(name))) continue;
    const path = join(source, name);
    requireCheck(lstatSync(path).isFile(), 'UNSAFE_PAGES_SOURCE');
    files.set(name, readFileSync(path));
  }
  for (const name of ['app.js', 'index.html', 'build-info.json', 'release-status.json', 'site-status.json',
    'test/app.js', 'test/index.html', 'test/staging-manifest.json']) requireCheck(files.has(name), 'MISSING_LOCKED_PAGES_ASSET:' + name);
  return files;
}

export function bindPages(files, lock, proof, baseline, currentStatus, now = new Date()) {
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
  const manifest = {schemaVersion: 2, environment: 'production', publicationState: 'PUBLISHED',
    businessVersion: releaseVersion, frontendBuild: build, frontendSourceCommit: lock.frontendSha,
    backendSourceCommit: lock.backendSha, backendApiVersion: proof.apiVersion, apiFunction: proof.apiFunction,
    backendApiBundleSha256: proof.apiBundleSha256,
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
      requireCheck(current.frontendBuild === expected.frontendBuild && current.businessVersion === expected.businessVersion &&
        current.frontendSourceCommit === expected.frontendSourceCommit && current.backendSourceCommit === expected.backendSourceCommit &&
        current.apiFunction === expected.apiFunction && current.backendApiVersion === expected.backendApiVersion &&
        current.backendApiBundleSha256 === expected.backendApiBundleSha256, 'PUBLISHED_PAIR_MISMATCH');
      const api = await fetch('https://api.supabase.com/v1/projects/' + project + '/functions/' + expected.apiFunction, {
        headers: {Authorization: 'Bearer ' + token}, redirect: 'error', signal: AbortSignal.timeout(12000)
      });
      requireCheck(api.ok, 'SERVED_API_METADATA_UNAVAILABLE');
      const provider = await api.json();
      requireCheck(provider.slug === expected.apiFunction && provider.status === 'ACTIVE' &&
        provider.version === expected.backendApiVersion && provider.ezbr_sha256 === expected.backendApiBundleSha256,
      'SERVED_API_PROVIDER_DRIFT');
      for (const file of ['index.html', 'app.js', 'test/index.html', 'test/app.js', 'test/staging-manifest.json']) {
        const response = await fetch(new URL(file + '?readback=' + Date.now(), site), {redirect: 'error', signal: AbortSignal.timeout(20000)});
        requireCheck(response.ok && digest(Buffer.from(await response.arrayBuffer())) === expected.assets[file],
          'PUBLISHED_ASSET_HASH_MISMATCH');
      }
      return;
    } catch {
      if (i === 19) throw Error('PUBLISHED_PAGES_READBACK_FAILED');
      await new Promise(done => setTimeout(done, 6000));
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [mode, source, out, proofPath] = process.argv.slice(2);
    if (mode === 'verify') {
      await verifyServed(JSON.parse(readFileSync(join(out, manifestName), 'utf8')));
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
        bindPages(files, lock, proof, baseline, status);
        mkdirSync(out);
        for (const [name, data] of files) {
          const target = join(out, name);
          mkdirSync(dirname(target), {recursive: true});
          writeFileSync(target, data);
        }
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
