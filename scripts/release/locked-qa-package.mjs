import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {checkoutSha} from './locked-evidence-run.mjs';
import {digest, qaFunction, qaProject, qaRun, requireCheck, sha64} from './locked-release.mjs';

const esbuildVersion = '0.25.12';
const buildFlags = [
  '--bundle', '--minify', '--charset=utf8', '--format=esm', '--target=es2022',
  '--external:npm:*', '--external:https:*', '--external:jsr:*', '--external:node:*'
];
const recipeSha256 = digest(readFileSync(new URL(import.meta.url)));

function apiSourceFiles(directory) {
  return readdirSync(directory, {withFileTypes: true})
    .filter(file => /\.(ts|mjs|json)$/.test(file.name))
    .map(file => {
      requireCheck(file.isFile(), 'UNSAFE_QA_SOURCE_FILE');
      return file.name;
    })
    .sort();
}

export function qaInputSha256(source, lock) {
  checkoutSha(source, lock.backendSha, {ancestor: true, cleanPath: 'src/transport-application'});
  const directory = join(source, 'src/transport-application');
  const files = apiSourceFiles(directory).map(name => [name, digest(readFileSync(join(directory, name)))]);
  return digest(JSON.stringify({sourceCommit: lock.backendSha, esbuildVersion, buildFlags, recipeSha256,
    target: [qaProject, qaFunction, qaRun], files}));
}

export function verifyQaPackageProof(proof, lock, inputSha256) {
  requireCheck(proof?.sourceCommit === lock.backendSha && proof.qaInputSha256 === inputSha256 &&
    sha64.test(inputSha256) && sha64.test(proof.entrySha256) && sha64.test(proof.configSha256),
  'LOCKED_QA_PACKAGE_MISMATCH');
  return proof;
}

// Both the business transaction and every detached audit transaction must run
// with the isolated role before any database access. Only the reviewed layouts
// are supported; a new transaction or misplaced search path fails closed.
export function isolateQaTransactions(code) {
  const search = 'await tx.unsafe(searchPathStatement(DATA_SCHEMA));';
  const role = 'await tx.unsafe("SET LOCAL ROLE freight_qa_' + qaRun + '_runner");';
  const normal = 'await sql.begin(async (tx) => {\n      ' + search;
  const pending = 'await sql.begin(async tx=>{\n        ' + search + '\n        await auditDetachedResponse(tx,req,pending,requestId,';
  const rollback = 'await sql.begin(async tx=>{\n        ' + search + '\n        await auditDetachedResponse(tx,req,errorResponse,requestId,';
  const legacy = 'await sql.begin(async (tx) => {\n        const token';
  const count = (source, needle) => source.split(needle).length - 1;
  const modern = [normal,pending,rollback];
  const old = [normal,legacy];
  const valid = anchors => anchors.every(a => count(code,a) === 1) &&
    (code.match(/\bsql\s*\.\s*begin\s*\(/g) || []).length === anchors.length;
  const isModern = valid(modern) && count(code,search) === 3 && count(code,legacy) === 0;
  const isLegacy = valid(old) && count(code,search) === 1;
  requireCheck(!code.includes('SET LOCAL ROLE') && (isModern || isLegacy), 'UNREVIEWED_ISOLATED_API_TRANSFORMATION');
  code = code.replaceAll(search, role + '\n      ' + search);
  if (isLegacy) code = code.replace(legacy, 'await sql.begin(async (tx) => {\n        ' + role + '\n        const token');
  requireCheck(count(code,role) === (isModern ? 3 : 2), 'ISOLATED_QA_ROLE_INJECTION_MISMATCH');
  return code;
}

function prepareQaApi(source, out, lock) {
  const directory = join(source, 'src/transport-application');
  mkdirSync(out);
  for (const name of apiSourceFiles(directory)) {
    copyFileSync(join(directory, name), join(out, name));
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
  code = isolateQaTransactions(code);
  replace('service: "freight-quotes", release: SOURCE_BUILD,', 'service: "freight-quotes", release: SOURCE_BUILD,' +
    ' backendSha: ' + JSON.stringify(lock.backendSha) + ', deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID"),');
  writeFileSync(entry, code);
}

export function buildQaApi(source, out, lock) {
  const inputSha256 = qaInputSha256(source, lock);
  const input = out + '-source';
  prepareQaApi(source, input, lock);
  mkdirSync(out);
  const env = {...process.env};
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  delete env.SUPABASE_ACCESS_TOKEN;
  execFileSync('npm', ['exec', '--yes', '--package=esbuild@' + esbuildVersion, '--', 'esbuild',
    join(input, 'index.ts'), ...buildFlags, '--outfile=' + join(out, 'index.ts')], {env, stdio: 'inherit'});
  copyFileSync(join(input, 'deno.json'), join(out, 'deno.json'));
  const proof = {sourceCommit: lock.backendSha, qaInputSha256: inputSha256,
    entrySha256: digest(readFileSync(join(out, 'index.ts'))),
    configSha256: digest(readFileSync(join(out, 'deno.json')))};
  return proof;
}
