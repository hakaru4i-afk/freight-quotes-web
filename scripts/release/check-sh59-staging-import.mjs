import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const [importDir, sourceDir, lockFile, receiptFile] = process.argv.slice(2);
assert.ok(importDir && sourceDir && lockFile && receiptFile, 'STAGING_IMPORT_ARGUMENTS_REQUIRED');
const imported = realpathSync(importDir);
const source = realpathSync(sourceDir);
const lock = JSON.parse(readFileSync(lockFile));
const manifest = JSON.parse(readFileSync(join(imported, 'staging-manifest.json')));
const target = manifest.sh59IsolatedQa;
const git = (...args) => execFileSync('git', args, {cwd:source, encoding:'utf8'}).trim();
assert.equal(git('rev-parse', 'HEAD'), lock.frontendSha, 'TESTED_CHECKOUT_MISMATCH');
assert.equal(git('rev-parse', 'HEAD:test'), lock.frontendTestTreeSha, 'TESTED_TREE_MISMATCH');
assert.equal(lock.state, 'TESTED_SOURCE_HANDOFF_NOT_DEPLOYED');
assert.equal(lock.productionAuthorized, false);
assert.equal(lock.verifiedScenarios, 37);
assert.equal(lock.businessVersion, manifest.primaryBusinessVersion);
assert.equal(lock.backendSha, target.sourceCommit);
assert.equal(lock.apiVersion, 20);
assert.equal(lock.apiVersion, target.version);
assert.equal(lock.apiBundleSha256, target.providerBundleSha256);
for (const name of ['index.html', 'app.js', 'staging-manifest.json']) {
  assert.equal(digest(readFileSync(join(imported, name))), lock.assets['test/' + name], 'IMPORTED_ASSET_MISMATCH:' + name);
}

const {checkIsolatedApiPair} = await import(pathToFileURL(join(source, 'scripts/check-isolated-api-pair.mjs')));
const pair = await checkIsolatedApiPair(source);
assert.equal(pair.backendSha, lock.backendSha);
assert.equal(pair.backendVersion, lock.apiVersion);
const isolatedApi = 'https://' + target.projectRef + '.supabase.co/functions/v1/' + target.function;
const defaultApi = 'https://' + target.projectRef + '.supabase.co/functions/v1/freight-api';
const proxyPrefix = '/_sh59_isolated';
const allowed = new Set(['/health', '/api/carrier', '/api/portal-feedback']);
const contentTypes = new Map([
  ['html', 'text/html; charset=utf-8'], ['js', 'application/javascript'], ['mjs', 'application/javascript'],
  ['json', 'application/json'], ['css', 'text/css'], ['svg', 'image/svg+xml'], ['png', 'image/png'],
  ['woff2', 'font/woff2'], ['webp', 'image/webp']
]);

// The isolated importer installs this deployment configuration ahead of the
// existing staging transport. The archived application bundles are served byte for byte.
const binding = `(() => {
  const send = window.fetch.bind(window);
  const original = new URL(${JSON.stringify(defaultApi)});
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const path = url.origin === original.origin && url.pathname.startsWith(original.pathname + '/')
      ? url.pathname.slice(original.pathname.length)
      : url.origin === location.origin && url.pathname.startsWith('/api/') ? url.pathname : '';
    if (!path) return send(input, init);
    const bound = new URL(${JSON.stringify(proxyPrefix)} + path + url.search, location.origin);
    return send(input instanceof Request ? new Request(bound.href, input) : bound.href, init);
  };
})();`;
const index = readFileSync(join(imported, 'index.html'), 'utf8');
const anchor = '<script src="./staging-transport-20261111.js?';
assert.equal(index.split(anchor).length, 2, 'STAGING_TRANSPORT_ANCHOR_CHANGED');
const deployedIndex = index.replace(anchor, '<script src="/_sh59-stage-binding.js"></script>' + anchor);
const forwarded = [];

const server = createServer(async (req, res) => {
  const send = (status, contentType, body, headers = {}) => {
    res.writeHead(status, {'content-type': contentType, 'cache-control': 'no-store', ...headers});
    res.end(body);
  };
  try {
    if (req.method !== 'GET') return send(405, 'text/plain', 'Read-only staging verification');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/_sh59-stage-binding.js') return send(200, 'application/javascript', binding);
    if (url.pathname.startsWith(proxyPrefix + '/')) {
      const path = url.pathname.slice(proxyPrefix.length);
      if (!allowed.has(path)) return send(404, 'application/json', '{"error":"Route outside staging check"}');
      const upstream = new URL(isolatedApi + path);
      upstream.searchParams.set('forceFunctionRegion', 'eu-central-1');
      if (path === '/api/portal-feedback') upstream.searchParams.set('view', 'notices');
      const response = await fetch(upstream, {
        redirect: 'error', signal: AbortSignal.timeout(15000), headers: {Origin: 'https://hakaru4i-afk.github.io'}
      });
      const requestId = response.headers.get('x-freight-request-id');
      forwarded.push({path, status: response.status, requestId});
      const headers = requestId ? {'x-freight-request-id': requestId} : {};
      return send(response.status, response.headers.get('content-type') || 'application/json',
        Buffer.from(await response.arrayBuffer()), headers);
    }
    if (url.pathname === '/test/' || url.pathname === '/test/index.html') {
      return send(200, 'text/html; charset=utf-8', deployedIndex);
    }
    if (!url.pathname.startsWith('/test/')) return send(404, 'text/plain', 'Not found');
    const file = resolve(imported, decodeURIComponent(url.pathname.slice('/test/'.length)));
    if (!file.startsWith(imported + sep) || !statSync(file, {throwIfNoEntry:false})?.isFile() ||
        !realpathSync(file).startsWith(imported + sep)) return send(404, 'text/plain', 'Not found');
    return send(200, contentTypes.get(file.split('.').at(-1)) || 'application/octet-stream', readFileSync(file));
  } catch {
    send(502, 'text/plain', 'Staging import request failed');
  }
});

await new Promise((ready, reject) => server.once('error', reject).listen(0, '127.0.0.1', ready));
const stageUrl = 'http://127.0.0.1:' + server.address().port + '/test/';
let browser;
try {
  browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const page = await browser.newPage({serviceWorkers:'block'});
  const appResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/test/app.js');
  const errors = [];
  const directSupabase = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).hostname.endsWith('.supabase.co')) directSupabase.push(request.method());
  });
  const indexResponse = await page.goto(stageUrl, {waitUntil:'domcontentloaded'});
  assert.equal(indexResponse.status(), 200);
  assert.equal(digest(await indexResponse.body()), digest(deployedIndex));
  const app = await appResponse;
  assert.equal(app.status(), 200);
  assert.equal(digest(await app.body()), lock.assets['test/app.js']);
  await page.locator('#root').waitFor({state:'visible'});
  const checks = await page.evaluate(async base => {
    const health = await fetch(base + '/health');
    const carrier = await fetch(base + '/api/carrier');
    const notices = await fetch('/api/portal-feedback?view=notices');
    return {healthStatus:health.status, health:await health.json(), carrier:carrier.status, notices:notices.status};
  }, defaultApi);
  assert.equal(checks.healthStatus, 200);
  assert.equal(checks.health.edgeVersion, 20);
  assert.equal(checks.health.qaRun, 'carrier124nov18');
  assert.equal(checks.health.projectRef, target.projectRef);
  assert.equal(checks.health.environment, 'staging');
  assert.equal(checks.health.release, lock.businessVersion);
  assert.ok([401, 403].includes(checks.carrier));
  assert.ok([401, 403].includes(checks.notices));
  assert.deepEqual(directSupabase, [], 'BROWSER_BYPASSED_STAGING_BINDING');
  assert.deepEqual(errors, []);
  writeFileSync(receiptFile, JSON.stringify({result:'PASS', scope:'ISOLATED_STAGING_IMPORT',
    frontendSha:lock.frontendSha, frontendTree:lock.frontendTestTreeSha, backendSha:lock.backendSha,
    apiVersion:lock.apiVersion, apiBundleSha256:lock.apiBundleSha256, protectedRunId:lock.protectedRunId,
    auditRunId:lock.auditRunId, appSha256:lock.assets['test/app.js'], servedIndexSha256:digest(deployedIndex),
    stagingBindingSha256:digest(binding), checkedRequests:forwarded, productionAuthorized:false
  }, null, 2) + '\n');
  console.log('SH59_ISOLATED_STAGING_BROWSER_IMPORT_PASS', lock.frontendSha, 'API', lock.apiVersion);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
