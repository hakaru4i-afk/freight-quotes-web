import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const site = 'https://hakaru4i-afk.github.io/freight-quotes-web/';
const targets = {
  production: {path: '', project: 'ooclsrndeygojtofuyte'},
  staging: {path: 'test/', project: 'ibclzdkxiozbzmniiygv'}
};
const sha40 = /^[a-f0-9]{40}$/;
const sha64 = /^[a-f0-9]{64}$/;
const buildId = /^[a-f0-9]{20}$/;
const releaseId = /^SH-(\d{2})\.(\d{2})\.(\d{2}) v$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function nextReleaseVersion(current) {
  const match = releaseId.exec(current);
  if (!match) throw Error('INVALID_LIVE_RELEASE_VERSION');
  const ordinal = Number(match.slice(1).join('')) + 1;
  if (ordinal > 999999) throw Error('RELEASE_VERSION_SPACE_EXHAUSTED');
  return 'SH-' + String(ordinal).padStart(6, '0').match(/../g).join('.') + ' v';
}

export async function verifyLiveRelease({fetcher = fetch, token, observations} = {}) {
  const read = async (url, headers = {}) => {
    const response = await fetcher(url, {
      cache: 'no-store', redirect: 'error', headers, signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) throw Error('HTTP_' + response.status + ':' + new URL(url).pathname);
    return Buffer.from(await response.arrayBuffer());
  };
  const json = async (url, headers) => JSON.parse(await read(url, headers));
  const audit = async (environment, {path, project}) => {
    const blockers = [];
    const check = (condition, code) => { if (!condition) blockers.push(code); };
    const optional = async (operation, code) => {
      try { return await operation; }
      catch { blockers.push(code); return null; }
    };
    const root = new URL(path, site);
    const manifestName = environment === 'production' ? 'production-release-manifest.json' : 'staging-manifest.json';
    const manifestUrl = new URL(manifestName, root);
    const healthUrl = new URL('https://' + project + '.supabase.co/functions/v1/freight-api/health');
    const providerUrl = new URL('https://api.supabase.com/v1/projects/' + project + '/functions/freight-api');
    const readProvider = token ? json(providerUrl, {Authorization: 'Bearer ' + token}) : Promise.resolve(observations?.[environment]);
    const [manifestData, buildFile, healthData, observation] = await Promise.all([
      optional(json(manifestUrl), 'PAGES_MANIFEST_UNAVAILABLE'),
      optional(read(new URL('build-info.json', root)).then(bytes => ({bytes, info: JSON.parse(bytes)})), 'PAGES_BUILD_INFO_UNAVAILABLE'),
      optional(json(healthUrl), 'API_HEALTH_UNAVAILABLE'),
      optional(readProvider, 'PROVIDER_METADATA_REQUEST_FAILED')
    ]);
    const manifest = manifestData ?? {};
    const info = buildFile?.info ?? {};
    const health = healthData ?? {};

    check(manifest.environment === environment && info.environment === environment && info.projectRef === project,
      'PAGES_ENVIRONMENT_MISMATCH');
    check(health.ok === true && health.environment === environment && health.projectRef === project && !health.qaRun,
      'API_ENVIRONMENT_MISMATCH');

    const version = environment === 'production' ? manifest.businessVersion : manifest.primaryBusinessVersion ?? info.primaryBusinessVersion;
    const frontendSha = environment === 'production' ? manifest.frontendSourceCommit : manifest.frontendCommit;
    const apiVersion = environment === 'production' ? manifest.backendApiVersion : manifest.apiVersion ?? info.lastObservedBackendVersion;
    const declaredBundle = environment === 'production' ? manifest.backendApiBundleSha256 : manifest.apiBundleSha256;
    check(releaseId.test(version), 'INVALID_RELEASE_VERSION');
    check(sha40.test(frontendSha), 'INVALID_FRONTEND_SHA');
    check(sha40.test(manifest.backendSourceCommit), 'INVALID_BACKEND_SHA');
    check(Number.isSafeInteger(apiVersion) && apiVersion > 0, 'INVALID_DECLARED_API_VERSION');
    const providerValid = observation?.slug === 'freight-api' && observation.status === 'ACTIVE' &&
      Number.isSafeInteger(observation.version) && observation.version > 0 && sha64.test(observation.ezbr_sha256);
    check(providerValid, 'PROVIDER_METADATA_UNVERIFIED');
    if (providerValid) {
      check(apiVersion === observation.version, 'API_VERSION_DRIFT');
      if (sha64.test(declaredBundle)) check(declaredBundle === observation.ezbr_sha256, 'API_BUNDLE_DRIFT');
      else check(false, 'DECLARED_API_BUNDLE_MISSING');
    }

    const requiredAssets = ['index.html', 'app.js', 'build-info.json'];
    const assets = environment === 'production' ? manifest.assets : manifest.assetHashes;
    const fetched = new Map([['build-info.json', buildFile?.bytes]]);
    if (environment === 'production') {
      const status = await optional(read(new URL('release-status.json', root)).then(bytes => {
        fetched.set('release-status.json', bytes);
        return JSON.parse(bytes);
      }), 'RELEASE_STATUS_UNAVAILABLE');
      check(info.releaseVersion === version && status?.version === version && status?.status === 'released' &&
        info.frontendSourceCommit === frontendSha && info.backendSourceCommit === manifest.backendSourceCommit &&
        info.backendApiVersion === apiVersion && info.build === manifest.frontendBuild && buildId.test(info.build),
      'PRODUCTION_METADATA_DRIFT');
      requiredAssets.push('release-status.json', 'site-status.json');
    } else {
      check(info.primaryBusinessVersion === version && info.lastObservedBackendVersion === apiVersion,
        'STAGING_METADATA_DRIFT');
      // A historical Git commit or successful health request cannot bind the provider bundle to source.
      check(manifest.runtimePairStatus === 'VERIFIED', 'STAGING_RUNTIME_SOURCE_UNVERIFIED');
    }

    const verified = await Promise.all(requiredAssets.map(async name => {
      const digest = assets?.[path + name];
      const bytes = fetched.has(name) ? fetched.get(name) : await optional(read(new URL(name, root)), 'ASSET_UNAVAILABLE:' + name);
      const matches = bytes != null && sha64.test(digest) && hash(bytes) === digest;
      check(matches, 'ASSET_DRIFT:' + name);
      return matches;
    }));

    return {
      environment, version, frontendSha, backendSha: manifest.backendSourceCommit,
      declaredApiVersion: apiVersion, observedApiVersion: providerValid ? observation.version : null,
      observedBundleSha256: providerValid ? observation.ezbr_sha256 : null, verifiedAssets: verified.filter(Boolean).length,
      blockers: blockers.sort()
    };
  };

  const environments = await Promise.all(Object.entries(targets).map(([env, target]) => audit(env, target)));
  const production = environments[0];
  return {
    status: environments.every(record => record.blockers.length === 0) ? 'LIVE_METADATA_VERIFIED' : 'RELEASE_BLOCKED',
    nextBusinessVersion: releaseId.test(production.version) ? nextReleaseVersion(production.version) : null,
    environments
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const observations = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : undefined;
  const result = await verifyLiveRelease({token, observations});
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'LIVE_METADATA_VERIFIED') process.exitCode = 1;
}
