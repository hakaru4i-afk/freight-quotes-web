import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nextReleaseVersion, verifyLiveRelease} from '../scripts/release/verify-live-release.mjs';

const frontend = 'a'.repeat(40);
const backend = 'b'.repeat(40);
const bundle = 'c'.repeat(64);
const build = 'd'.repeat(20);
const release = 'SH-01.30.99 v';
const productionRef = 'ooclsrndeygojtofuyte';
const stagingRef = 'ibclzdkxiozbzmniiygv';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const files = new Map();
  const write = (name, value) => files.set(name, typeof value === 'string' ? value : JSON.stringify(value));
  for (const [environment, path, project, version] of [['production', '', productionRef, 70], ['staging', 'test/', stagingRef, 118]]) {
    write(path + 'index.html', '<title>Freight Quotes</title>');
    write(path + 'app.js', 'const build = 1;');
    write(path + 'build-info.json', {
      environment, projectRef: project, releaseVersion: release, primaryBusinessVersion: release, build,
      frontendSourceCommit: frontend, backendSourceCommit: backend, backendApiVersion: version, lastObservedBackendVersion: version
    });
    const assets = ['index.html', 'app.js', 'build-info.json'];
    if (!path) {
      write('release-status.json', {version: release, status: 'released'});
      write('site-status.json', {release: {version: release}});
      assets.push('release-status.json', 'site-status.json');
    }
    const digests = Object.fromEntries(assets.map(name => [path + name, sha(files.get(path + name))]));
    write(path + (path ? 'staging-manifest.json' : 'production-release-manifest.json'), path ? {
      environment, primaryBusinessVersion: release, frontendCommit: frontend, backendSourceCommit: backend,
      apiVersion: version, apiBundleSha256: bundle, assetHashes: digests, runtimePairStatus: 'VERIFIED'
    } : {
      environment, businessVersion: release, frontendBuild: build, frontendSourceCommit: frontend, backendSourceCommit: backend,
      backendApiVersion: version, backendApiBundleSha256: bundle, assets: digests
    });
    write(project + '/health', {ok: true, environment, projectRef: project});
    write(project + '/provider', {slug: 'freight-api', status: 'ACTIVE', version, ezbr_sha256: bundle});
  }

  const fetcher = async (url, init) => {
    if (url.hostname === 'api.supabase.com') {
      assert.equal(init.headers.Authorization, 'Bearer fixture-token');
      const project = url.pathname.split('/')[3];
      return new Response(files.get(project + '/provider'));
    }
    assert.equal(init.headers.Authorization, undefined);
    const key = url.hostname.endsWith('.supabase.co')
      ? url.hostname.split('.')[0] + '/health'
      : url.pathname.slice('/freight-quotes-web/'.length);
    return files.has(key) ? new Response(files.get(key)) : new Response(null, {status: 404});
  };
  return {files, write, fetcher, token: 'fixture-token'};
}

test('derives sequential versions with rollover from the actual production version', () => {
  assert.equal(nextReleaseVersion('SH-01.30.72 v'), 'SH-01.30.73 v');
  assert.equal(nextReleaseVersion(release), 'SH-01.31.00 v');
  assert.throws(() => nextReleaseVersion('SH73'), /INVALID_LIVE_RELEASE_VERSION/);
  assert.throws(() => nextReleaseVersion('SH-99.99.99 v'), /RELEASE_VERSION_SPACE_EXHAUSTED/);
});

test('checks both published environments, provider API versions and required asset bytes', async () => {
  const result = await verifyLiveRelease(fixture());
  assert.equal(result.status, 'LIVE_METADATA_VERIFIED');
  assert.equal(result.nextBusinessVersion, 'SH-01.31.00 v');
  assert.deepEqual(result.environments.map(record => record.verifiedAssets), [5, 3]);
});

test('reports provider drift and stale bytes even when both health endpoints are available', async () => {
  const input = fixture();
  input.write(productionRef + '/provider', {slug: 'freight-api', status: 'ACTIVE', version: 71, ezbr_sha256: 'e'.repeat(64)});
  input.write('test/app.js', 'const build = 2;');
  const result = await verifyLiveRelease(input);
  assert.equal(result.status, 'RELEASE_BLOCKED');
  assert.ok(result.environments[0].blockers.includes('API_VERSION_DRIFT'));
  assert.ok(result.environments[0].blockers.includes('API_BUNDLE_DRIFT'));
  assert.ok(result.environments[1].blockers.includes('ASSET_DRIFT:app.js'));
});

test('missing manifest and provider proof remain blockers while production observations survive', async () => {
  const input = fixture();
  input.files.delete('test/staging-manifest.json');
  const result = await verifyLiveRelease({...input, token: undefined});
  assert.equal(result.status, 'RELEASE_BLOCKED');
  assert.equal(result.environments[0].version, release);
  assert.equal(result.environments[1].declaredApiVersion, 118);
  assert.ok(result.environments[1].blockers.includes('PAGES_MANIFEST_UNAVAILABLE'));
  assert.ok(result.environments[1].blockers.includes('PROVIDER_METADATA_UNVERIFIED'));
});
