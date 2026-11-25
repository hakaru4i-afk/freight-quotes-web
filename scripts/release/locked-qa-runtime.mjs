import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {checkoutSha, readJson, runReceipt} from './locked-evidence-run.mjs';
import {qaInputSha256, verifyQaPackageProof} from './locked-qa-package.mjs';
import {findStagingProof, verifyExpectedDeployment} from './locked-qa-provenance.mjs';
import {digest, qaFunction, qaProject, qaRun, readLock, requireCheck, sha64, stagingUrl} from './locked-release.mjs';

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
async function downloadedFiles(form, metadata) {
  const files = new Map();
  for (const [key, value] of form) {
    if (key === 'metadata' && typeof value === 'string') continue;
    requireCheck(value instanceof File, 'UNEXPECTED_QA_API_DOWNLOAD_PART');
    const name = qaPackageFilename(value.name, metadata);
    requireCheck(!files.has(name), 'UNEXPECTED_QA_API_DOWNLOAD_PART');
    files.set(name, Buffer.from(await value.arrayBuffer()));
  }
  return files;
}

export async function verifyDownloadedPackage(form, apiPackage, metadata) {
  const files = await downloadedFiles(form, metadata);
  for (const name of ['index.ts', 'deno.json']) {
    requireCheck(files.get(name)?.equals(readFileSync(join(apiPackage, name))), 'SERVED_QA_API_SOURCE_MISMATCH');
  }
}

export async function verifyDownloadedHashes(form, proof, metadata) {
  const files = await downloadedFiles(form, metadata);
  for (const [name, expected] of [['index.ts', proof.entrySha256], ['deno.json', proof.configSha256]]) {
    requireCheck(files.has(name) && digest(files.get(name)) === expected, 'SERVED_QA_API_SOURCE_MISMATCH');
  }
}

// Read independent assets concurrently; any mismatch still blocks attestation.
export async function verifyServedAssets(frontend, read = request) {
  const names = ['index.html', 'app.js', 'style.css'];
  const entries = await Promise.all(names.map(async name => {
    const url = new URL(name, stagingUrl);
    url.searchParams.set('locked-qa', String(Date.now()));
    const bytes = Buffer.from(await (await read(url)).arrayBuffer());
    requireCheck(bytes.equals(readFileSync(join(frontend, 'test', name))), 'SERVED_STAGING_ASSET_MISMATCH:' + name);
    return [name, digest(bytes)];
  }));
  return Object.fromEntries(entries);
}

export async function attestQaApi(lock, proof, token, expectedDeployment) {
  requireCheck(token, 'QA_PROVIDER_READBACK_CREDENTIAL_REQUIRED');
  const management = 'https://api.supabase.com/v1/projects/' + qaProject + '/functions/' + qaFunction;
  const headers = {Authorization: 'Bearer ' + token};
  const metadata = await (await request(management, headers)).json();
  requireCheck(metadata.slug === qaFunction && metadata.status === 'ACTIVE' && metadata.verify_jwt === false &&
    Number.isSafeInteger(metadata.version) && metadata.version > 0 && sha64.test(metadata.ezbr_sha256) &&
    typeof metadata.id === 'string' && /^[a-f0-9-]{36}$/.test(metadata.id), 'SERVED_QA_API_PROVIDER_PROOF_MISSING');
  if (expectedDeployment) verifyExpectedDeployment(expectedDeployment, metadata);
  const [deployed, health] = await Promise.all([
    request(management + '/body', {...headers, Accept: 'multipart/form-data'}),
    request('https://' + qaProject + '.supabase.co/functions/v1/' + qaFunction + '/health').then(response => response.json())
  ]);
  requireCheck(deployed.headers.get('content-type')?.startsWith('multipart/form-data;'), 'SERVED_QA_API_DOWNLOAD_INVALID');
  await verifyDownloadedHashes(await deployed.formData(), proof, metadata);
  requireCheck(health.ok === true && health.projectRef === qaProject && health.environment === 'staging' &&
    health.qaRun === qaRun && health.backendSha === lock.backendSha &&
    health.deploymentId === [qaProject, metadata.id, metadata.version].join('_'), 'SERVED_QA_API_RUNTIME_MISMATCH');
  const confirm = await (await request(management, headers)).json();
  requireCheck(confirm.id === metadata.id && confirm.version === metadata.version &&
    confirm.ezbr_sha256 === metadata.ezbr_sha256, 'SERVED_QA_API_CHANGED_DURING_READBACK');
  return {project: qaProject, function: qaFunction, id: metadata.id, version: metadata.version, bundle: metadata.ezbr_sha256};
}

export async function attestRuntime(lock, frontend, proof, token, expectedDeployment) {
  checkoutSha(frontend, lock.frontendSha, {cleanPath: 'test'});
  const [deployment, servedHashes] = await Promise.all([
    attestQaApi(lock, proof, token, expectedDeployment),
    verifyServedAssets(frontend)
  ]);
  return {...lock, function: qaFunction, version: deployment.version, bundle: deployment.bundle, deployment,
    sourceCommit: lock.backendSha, qaEntrySha256: proof.entrySha256, qaInputSha256: proof.qaInputSha256,
    stagingUrl, servedHashes, observedAt: new Date().toISOString()};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [mode, frontend, backend, packagePath, receiptPath] = process.argv.slice(2);
  const lock = readLock();
  runReceipt(lock, 'e2e');
  const input = qaInputSha256(backend, lock);
  let staging;
  if (mode === 'select-and-attest') {
    staging = findStagingProof(lock, input, process.env.GH_TOKEN);
    requireCheck(staging, 'TRUSTED_QA_STAGING_RECEIPT_NOT_FOUND');
    writeFileSync(packagePath, JSON.stringify(staging) + '\n', {flag: 'wx', mode: 0o600});
  } else if (mode === 'attest') {
    staging = readJson(packagePath);
  } else throw Error('UNKNOWN_LOCKED_QA_COMMAND');
  const proof = verifyQaPackageProof(staging.package, lock, input);
  const runtime = await attestRuntime(lock, frontend, proof, process.env.SUPABASE_ACCESS_TOKEN, staging.deployment);
  writeFileSync(receiptPath, JSON.stringify(runtime) + '\n', {flag: 'wx', mode: 0o600});
}
