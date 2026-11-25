import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {checkoutSha, readJson, runReceipt} from './locked-evidence-run.mjs';
import {digest, qaFunction, qaProject, qaRun, readLock, requireCheck, sha64, stagingUrl} from './locked-release.mjs';

export function prepareQaApi(source, out, lock) {
  checkoutSha(source, lock.backendSha, {ancestor: true, cleanPath: 'src/transport-application'});
  const directory = join(source, 'src/transport-application');
  mkdirSync(out);
  const files = readdirSync(directory, {withFileTypes: true})
    .filter(file => /\.(ts|mjs|json)$/.test(file.name));
  for (const file of files) {
    requireCheck(file.isFile(), 'UNSAFE_QA_SOURCE_FILE');
    copyFileSync(join(directory, file.name), join(out, file.name));
  }
  const entry = join(out, 'index.ts');
  let code = readFileSync(entry, 'utf8');
  const replace = (before, after) => {
    requireCheck(code.split(before).length === 2, 'UNREVIEWED_ISOLATED_API_TRANSFORMATION');
    code = code.replace(before, after);
  };
  requireCheck(code.includes('var EXPECTED_PROJECT = "' + qaProject + '";') &&
    code.includes('var DEPLOYMENT_ENV = "staging";'), 'ISOLATED_QA_PROJECT_REQUIRED');
  replace('var DATA_SCHEMA = "freight";', 'var DATA_SCHEMA = "freight_qa_' + qaRun + '";');
  replace('var STORAGE_BUCKET = "freight-documents";', 'var STORAGE_BUCKET = "freight-documents-qa-' + qaRun + '";');
  replace('var API_FUNCTION = "freight-api";', 'var API_FUNCTION = "' + qaFunction + '";');
  replace('var QA_RUN = "";', 'var QA_RUN = "' + qaRun + '";');
  code = code.replaceAll('freight.', 'freight_qa_' + qaRun + '.');
  const role = 'await tx.unsafe("SET LOCAL ROLE freight_qa_' + qaRun + '_runner");';
  replace('await tx.unsafe(searchPathStatement(DATA_SCHEMA));',
    role + '\n      await tx.unsafe(searchPathStatement(DATA_SCHEMA));');
  replace('await sql.begin(async (tx) => {\n        const token',
    'await sql.begin(async (tx) => {\n        ' + role + '\n        const token');
  replace('service: "freight-quotes", release: SOURCE_BUILD,', 'service: "freight-quotes", release: SOURCE_BUILD,' +
    ' backendSha: ' + JSON.stringify(lock.backendSha) + ', deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID"),');
  writeFileSync(entry, code);
}

export function buildQaApi(source, out, lock) {
  const input = out + '-source';
  prepareQaApi(source, input, lock);
  mkdirSync(out);
  execFileSync('npm', ['exec', '--yes', '--package=esbuild@0.25.12', '--', 'esbuild', join(input, 'index.ts'),
    '--bundle', '--minify', '--charset=utf8', '--format=esm', '--target=es2022',
    '--external:npm:*', '--external:https:*', '--external:jsr:*', '--external:node:*',
    '--outfile=' + join(out, 'index.ts')], {stdio: 'inherit'});
  copyFileSync(join(input, 'deno.json'), join(out, 'deno.json'));
  const entrySha256 = digest(readFileSync(join(out, 'index.ts')));
  writeFileSync(join(out, 'package-proof.json'), JSON.stringify({sourceCommit: lock.backendSha, entrySha256}) + '\n');
}

async function request(url, headers) {
  const response = await fetch(url, {headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000)});
  requireCheck(response.ok, 'LOCKED_QA_HTTP_' + response.status);
  return response;
}

// Management API returns either relative source paths or deployment-qualified paths.
export function qaPackageFilename(filename, metadata) {
  const prefix = metadata && /^[a-f0-9-]{36}$/.test(metadata.id) &&
    Number.isSafeInteger(metadata.version) && metadata.version > 0
    ? '/tmp/user_fn_' + [qaProject, metadata.id, metadata.version].join('_') + '/' : '';
  let name = filename;
  if (prefix && name.startsWith(prefix)) name = name.slice(prefix.length);
  if (name.startsWith('source/')) name = name.slice(7);
  requireCheck(['index.ts', 'deno.json'].includes(name), 'UNEXPECTED_QA_API_DOWNLOAD_PART');
  return name;
}
export async function verifyDownloadedPackage(form, apiPackage, metadata) {
  const files = new Map();
  for (const [key, value] of form) {
    if (key === 'metadata' && typeof value === 'string') continue;
    requireCheck(value instanceof File, 'UNEXPECTED_QA_API_DOWNLOAD_PART');
    const name = qaPackageFilename(value.name, metadata);
    requireCheck(!files.has(name), 'UNEXPECTED_QA_API_DOWNLOAD_PART');
    files.set(name, Buffer.from(await value.arrayBuffer()));
  }
  for (const name of ['index.ts', 'deno.json']) {
    requireCheck(files.get(name)?.equals(readFileSync(join(apiPackage, name))), 'SERVED_QA_API_SOURCE_MISMATCH');
  }
}

export async function attestRuntime(lock, frontend, apiPackage, token) {
  checkoutSha(frontend, lock.frontendSha, {cleanPath: 'test'});
  requireCheck(token, 'QA_PROVIDER_READBACK_CREDENTIAL_REQUIRED');
  const qaEntrySha256 = digest(readFileSync(join(apiPackage, 'index.ts')));
  const packageProof = readJson(join(apiPackage, 'package-proof.json'));
  requireCheck(packageProof.sourceCommit === lock.backendSha && qaEntrySha256 === packageProof.entrySha256,
    'LOCKED_QA_PACKAGE_MISMATCH');
  const management = 'https://api.supabase.com/v1/projects/' + qaProject + '/functions/' + qaFunction;
  const headers = {Authorization: 'Bearer ' + token};
  const metadata = await (await request(management, headers)).json();
  requireCheck(metadata.slug === qaFunction && metadata.status === 'ACTIVE' && metadata.verify_jwt === false &&
    Number.isSafeInteger(metadata.version) && metadata.version > 0 && sha64.test(metadata.ezbr_sha256) &&
    typeof metadata.id === 'string' && /^[a-f0-9-]{36}$/.test(metadata.id), 'SERVED_QA_API_PROVIDER_PROOF_MISSING');
  const deployed = await request(management + '/body', {...headers, Accept: 'multipart/form-data'});
  requireCheck(deployed.headers.get('content-type')?.startsWith('multipart/form-data;'), 'SERVED_QA_API_DOWNLOAD_INVALID');
  await verifyDownloadedPackage(await deployed.formData(), apiPackage, metadata);
  const confirm = await (await request(management, headers)).json();
  requireCheck(confirm.id === metadata.id && confirm.version === metadata.version &&
    confirm.ezbr_sha256 === metadata.ezbr_sha256, 'SERVED_QA_API_CHANGED_DURING_READBACK');
  const health = await (await request('https://' + qaProject + '.supabase.co/functions/v1/' + qaFunction + '/health')).json();
  requireCheck(health.ok === true && health.projectRef === qaProject && health.environment === 'staging' &&
    health.qaRun === qaRun && health.backendSha === lock.backendSha &&
    health.deploymentId === [qaProject, metadata.id, metadata.version].join('_'), 'SERVED_QA_API_RUNTIME_MISMATCH');
  const servedHashes = {};
  for (const name of ['index.html', 'app.js', 'style.css']) {
    const url = new URL(name, stagingUrl);
    url.searchParams.set('locked-qa', String(Date.now()));
    const bytes = Buffer.from(await (await request(url)).arrayBuffer());
    requireCheck(bytes.equals(readFileSync(join(frontend, 'test', name))), 'SERVED_STAGING_ASSET_MISMATCH:' + name);
    servedHashes[name] = digest(bytes);
  }
  return {...lock, function: qaFunction, version: metadata.version, bundle: metadata.ezbr_sha256,
    sourceCommit: lock.backendSha, qaEntrySha256, stagingUrl, servedHashes, observedAt: new Date().toISOString()};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [mode, source, out, receipt] = process.argv.slice(2);
  const lock = readLock();
  runReceipt(lock, 'e2e');
  if (mode === 'build') buildQaApi(source, out, lock);
  else if (mode === 'attest') {
    const proof = await attestRuntime(lock, source, out, process.env.SUPABASE_ACCESS_TOKEN);
    writeFileSync(receipt, JSON.stringify(proof) + '\n', {flag: 'wx', mode: 0o600});
  } else throw Error('UNKNOWN_LOCKED_QA_COMMAND');
}
