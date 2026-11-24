import {copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {project, readLock, requireCheck, sha64, targetFunction} from './locked-release.mjs';

const host = 'https://' + project + '.supabase.co/functions/v1/';

export function prepareApi(source, workspace, lock, releaseVersion) {
  const slug = targetFunction(lock);
  requireCheck(/^SH-\d{2}\.\d{2}\.\d{2} v$/.test(releaseVersion), 'INVALID_API_TARGET_RELEASE');
  const out = join(workspace, 'supabase', 'functions', slug);
  mkdirSync(out, {recursive: true});
  const dir = join(source, 'src', 'transport-application');
  const files = readdirSync(dir).filter(name => /\.(ts|mjs|json)$/.test(name));
  requireCheck(files.includes('index.ts') && files.includes('deno.json') && files.length >= 20, 'INCOMPLETE_LOCKED_API_SOURCE');
  for (const name of files) {
    const input = join(dir, name);
    requireCheck(lstatSync(input).isFile(), 'UNSAFE_API_SOURCE_FILE');
    copyFileSync(input, join(out, name));
  }
  const entry = join(out, 'index.ts');
  let code = readFileSync(entry, 'utf8');
  const replace = (pattern, replacement) => {
    requireCheck([...code.matchAll(pattern)].length === 1, 'UNREVIEWED_LOCKED_API_TRANSFORMATION');
    code = code.replace(pattern, replacement);
  };
  replace(/^var EXPECTED_PROJECT = "[a-z0-9]+";$/gm, 'var EXPECTED_PROJECT = ' + JSON.stringify(project) + ';');
  replace(/^var DEPLOYMENT_ENV = "staging";$/gm, 'var DEPLOYMENT_ENV = "production";');
  replace(/^var API_FUNCTION = "freight-api";$/gm, 'var API_FUNCTION = ' + JSON.stringify(slug) + ';');
  replace(/^var SOURCE_BUILD = "[^"]*";$/gm, 'var SOURCE_BUILD = ' + JSON.stringify(releaseVersion) + ';');
  replace(/config\.functionName !== "freight-api"\) throw Error\("Unexpected default deployment targets"\);/g,
    '(config.functionName !== "freight-api" && !(config.environment === "production" && /^freight-api-release-[a-f0-9]{32}$/.test(config.functionName)))) throw Error("Unexpected default deployment targets");');
  replace(/if \(!\/\^freight-api\(\?:-qa-\[a-z0-9\]\{8,24\}\)\?\$\/\.test\(functionName\)\)/g,
    'if (!/^freight-api(?:-qa-[a-z0-9]{8,24}|-release-[a-f0-9]{32})?$/.test(functionName))');
  replace(/release: SOURCE_BUILD, legacyContractRelease:/g,
    'release: SOURCE_BUILD, frontendSha: ' + JSON.stringify(lock.frontendSha) +
    ', backendSha: ' + JSON.stringify(lock.backendSha) + ', apiFunction: API_FUNCTION, legacyContractRelease:');
  writeFileSync(entry, code);
  return slug;
}

export function verifyApiEvidence(lock, releaseVersion, metadata, health, deniedStatus) {
  const slug = targetFunction(lock);
  requireCheck(metadata?.slug === slug && metadata.status === 'ACTIVE' && metadata.verify_jwt === false &&
    Number.isSafeInteger(metadata.version) && metadata.version > 0 && sha64.test(metadata.ezbr_sha256), 'PROVIDER_API_IDENTITY_MISSING');
  requireCheck(health?.ok === true && health.environment === 'production' && health.projectRef === project &&
    health.apiFunction === slug && health.release === releaseVersion && health.contract === 'carrier-remedy-v1' &&
    health.frontendSha === lock.frontendSha && health.backendSha === lock.backendSha && deniedStatus === 403,
  'LOCKED_API_HEALTH_OR_ACCESS_FAILED');
  return {...lock, apiFunction: slug, apiVersion: metadata.version, apiBundleSha256: metadata.ezbr_sha256, releaseVersion};
}

export function deployBody(work, slug) {
  const dir = join(work, 'supabase', 'functions', slug);
  const form = new FormData();
  form.set('metadata', JSON.stringify({name: slug, entrypoint_path: 'index.ts', import_map_path: 'deno.json', verify_jwt: false}));
  for (const name of readdirSync(dir).sort()) {
    form.append('file', new Blob([readFileSync(join(dir, name))], {type: 'application/octet-stream'}), name);
  }
  return form;
}

async function publishApi(source, work, resultPath, lock, releaseVersion, token) {
  requireCheck(token, 'SUPABASE_RELEASE_CREDENTIAL_UNAVAILABLE');
  const slug = prepareApi(source, work, lock, releaseVersion);
  const management = 'https://api.supabase.com/v1/projects/' + project + '/functions/';
  const headers = {Authorization: 'Bearer ' + token};
  const signal = () => AbortSignal.timeout(12000);
  const metadata = async () => {
    const response = await fetch(management + slug, {headers, redirect: 'error', signal: signal()});
    if (response.status === 404) return null;
    requireCheck(response.ok, 'SUPABASE_METADATA_HTTP_' + response.status);
    return response.json();
  };
  const previous = await metadata();
  // Treat this function as immutable once created. An earlier failed Pages rollout can reuse it.
  if (!previous) {
    const response = await fetch(management + 'deploy?slug=' + encodeURIComponent(slug), {
      method: 'POST', body: deployBody(work, slug), headers, redirect: 'error', signal: AbortSignal.timeout(180000)
    });
    requireCheck(response.status === 201, 'SUPABASE_DEPLOY_HTTP_' + response.status);
  }
  for (let attempt = 0; attempt < 18; attempt++) {
    try {
      const [data, healthResponse, access] = await Promise.all([
        metadata(),
        fetch(host + slug + '/health', {cache: 'no-store', redirect: 'error', signal: signal()}),
        fetch(host + slug + '/api/owner-register-execution?register=remarks', {cache: 'no-store', redirect: 'error', signal: signal()})
      ]);
      requireCheck(healthResponse.ok, 'API_HEALTH_HTTP_' + healthResponse.status);
      const proof = verifyApiEvidence(lock, releaseVersion, data, await healthResponse.json(), access.status);
      writeFileSync(resultPath, JSON.stringify(proof) + '\n', {mode: 0o600});
      console.log('Verified the published API identity and private-route access control.');
      return;
    } catch {
      if (attempt === 17) throw Error('HEALTH_CHECK_FAILED_PAGES_NOT_UPDATED');
      await new Promise(done => setTimeout(done, 6000));
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [mode, source, work, resultPath] = process.argv.slice(2);
    const lock = readLock();
    const actual = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    requireCheck(actual === lock.backendSha, 'BACKEND_CHECKOUT_DOES_NOT_MATCH_RELEASE_LOCK');
    const version = process.env.RELEASE_VERSION;
    if (mode === 'prepare') {
      prepareApi(source, work, lock, version);
    } else if (mode === 'publish') {
      await publishApi(source, work, resultPath, lock, version, process.env.SUPABASE_ACCESS_TOKEN);
    } else {
      throw Error('INVALID_API_RELEASE_COMMAND');
    }
  } catch (error) {
    console.error(String(error.message).match(/^[A-Z0-9_:.-]+$/) ? error.message : 'API_RELEASE_FAILED');
    process.exitCode = 1;
  }
}
