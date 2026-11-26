import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const manifestPath = 'production-release-manifest.json';
const required = ['app.js', 'index.html', 'build-info.json', 'site-status.json'];
const versionPattern = /^SH-\d{2}\.\d{2}\.\d{2} v$/;
const hashPattern = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = (read, path) => JSON.parse(read(path));

function assetParts(name) {
  const parts = name.split('/');
  assert.ok(parts.every(part => part && part !== '.' && part !== '..' && !/[\\\0]/.test(part)),
    'Asset path must stay inside the release');
  return parts;
}

function filesystemReader(root) {
  return name => {
    const parts = assetParts(name);
    let path = resolve(root);
    for (const parent of parts.slice(0, -1)) {
      path = resolve(path, parent);
      assert.ok(lstatSync(path).isDirectory(), 'Release asset must not traverse a symlinked parent directory');
    }
    path = resolve(path, parts.at(-1));
    assert.ok(lstatSync(path).isFile(), 'Release assets must be ordinary files');
    return readFileSync(path);
  };
}

function assertProductionIdentity(read, manifest) {
  const info = readJson(read, 'build-info.json');
  const status = readJson(read, 'site-status.json');
  assert.equal(manifest.environment, 'production');
  assert.equal(info.environment, 'production');
  assert.equal(info.projectRef, 'ooclsrndeygojtofuyte');
  assert.match(manifest.businessVersion, versionPattern);
  assert.equal(info.releaseVersion, manifest.businessVersion, 'PRODUCTION_RELEASE_VERSION_MISMATCH');
  assert.equal(status.release.version, manifest.businessVersion, 'PRODUCTION_STATUS_VERSION_MISMATCH');
  assert.equal(info.build, manifest.frontendBuild);
  assert.equal(status.version, manifest.frontendBuild);
  if (manifest.schemaVersion === 2 || manifest.schemaVersion === 3) {
    assert.match(manifest.frontendSourceCommit, /^[a-f0-9]{40}$/);
    assert.match(manifest.backendSourceCommit, /^[a-f0-9]{40}$/);
    assert.match(manifest.backendApiBundleSha256, hashPattern);
    assert.equal(info.frontendSourceCommit, manifest.frontendSourceCommit);
    assert.equal(info.backendSourceCommit, manifest.backendSourceCommit);
    assert.equal(info.backendApiVersion, manifest.backendApiVersion);
    assert.equal(info.backendApiBundleSha256, manifest.backendApiBundleSha256);
    assert.equal(info.apiFunction, manifest.apiFunction);
    if (manifest.schemaVersion === 3) {
      assert.match(manifest.apiDeploymentId, /^ooclsrndeygojtofuyte_[a-f0-9-]{36}_[1-9]\d*$/);
      assert.ok(manifest.apiDeploymentId.endsWith('_' + manifest.backendApiVersion));
      assert.match(manifest.databaseSchemaVersion, /^\d{14}$/);
    }
  } else {
    assert.equal(info.sourceStagingBuild, manifest.sourceStagingBuild);
    assert.match(manifest.sourceStagingBuild, /^[a-f0-9]{20}$/);
    assert.match(manifest.sourceStagingFrontendCommit, /^[a-f0-9]{40}$/);
  }
}

function assertReleaseAsset(read, name, digest) {
  assetParts(name);
  assert.match(digest ?? '', hashPattern, 'Missing reviewed production digest: ' + name);
  const bytes = read(name);
  assert.equal(hash(bytes), digest, 'Unreviewed production asset: ' + name);
  return bytes;
}

function assertReleaseArtifact(read, {productionRootOnly = false} = {}) {
  const manifest = readJson(read, manifestPath);
  for (const path of required) assert.match(manifest.assets?.[path] ?? '', hashPattern);
  assertProductionIdentity(read, manifest);
  for (const [name, digest] of Object.entries(manifest.assets)) {
    // Staging may advance separately after a release. Historical packages still verify every declared byte.
    if (productionRootOnly && name.startsWith('test/')) continue;
    assertReleaseAsset(read, name, digest);
  }
  const app = read('app.js').toString('utf8');
  assert.ok(app.includes('ooclsrndeygojtofuyte'));
  assert.ok(!app.includes('ibclzdkxiozbzmniiygv'), 'Production must not call staging');
  assert.ok(read('index.html').toString('utf8').includes('app.js?v=' + manifest.frontendBuild));
  if (!productionRootOnly) {
    const stage = readJson(read, 'test/build-info.json');
    assert.equal(stage.environment, 'staging');
    assert.equal(stage.projectRef, 'ibclzdkxiozbzmniiygv');
  }
  return manifest;
}

export function assertProductionReleaseIntegrity(root = process.cwd()) {
  return assertReleaseArtifact(filesystemReader(root));
}

export function assertProductionFeatureBoundary(content, marker, root = process.cwd()) {
  if (!content.includes(marker)) return;
  assert.ok(existsSync(resolve(root, manifestPath)), 'A staging feature may enter production only through a complete release manifest');
  assertProductionReleaseIntegrity(root);
}

function productionHistory(root) {
  function git(args, options) {
    return execFileSync('git', ['-C', root, ...args], {maxBuffer: 32 * 1024 * 1024, ...options});
  }
  const readAt = (commit, path) => git(['show', `${commit}:${path}`]);
  const version = readJson(path => readAt('HEAD', path), manifestPath).businessVersion;
  assert.match(version, versionPattern);
  assert.equal(git(['rev-parse', '--is-shallow-repository'], {encoding: 'utf8'}).trim(), 'false',
    'Production baseline verification requires full Git history');

  // A candidate can change a source asset after publication. Resolve the original manifest for the
  // unchanged business version, before any subsequent source-specific edits to that manifest.
  const revisions = git(['log', '--first-parent', '--format=%H', 'HEAD', '--', manifestPath], {encoding: 'utf8'}).trim().split('\n');
  let commit;
  let manifest;
  for (const revision of revisions) {
    const entry = readJson(path => readAt(revision, path), manifestPath);
    if (entry.businessVersion !== version) break;
    commit = revision;
    manifest = entry;
  }
  assert.ok(commit && manifest.publicationState === 'PUBLISHED', 'Missing published production tree in Git history');

  return {
    commit,
    manifest,
    read(name) {
      assetParts(name);
      const object = git(['ls-tree', '-z', commit, '--', name], {encoding: 'utf8'});
      const match = /^100(?:644|755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(object);
      assert.ok(match?.[2] === name, 'Release assets must be ordinary files: ' + name);
      return git(['cat-file', 'blob', match[1]]);
    }
  };
}

export function assertHistoricalProductionRelease(root = process.cwd()) {
  const {commit, read} = productionHistory(root);
  return {commit, manifest: assertReleaseArtifact(read)};
}

export function assertProductionSourceFeatureBoundary(name, marker, root = process.cwd()) {
  if (!filesystemReader(root)(name).toString('utf8').includes(marker)) return;
  const {manifest, read} = productionHistory(root);
  const released = assertReleaseAsset(read, name, manifest.assets[name]).toString('utf8');
  assert.ok(released.includes(marker), 'A staging feature may enter production only through a complete release manifest');
}

export function assertPublishedProductionRoot(files) {
  const read = name => {
    assert.ok(files.has(name), 'Missing served production asset: ' + name);
    return files.get(name);
  };
  return assertReleaseArtifact(read, {productionRootOnly: true});
}
