import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {expectedReleasePair} from './release-evidence.mjs';

export function assertIsolatedHealth(health, pin, target) {
  if (health?.ok !== true || health?.service !== 'freight-quotes' ||
      health.environment !== 'staging' || health.projectRef !== target.projectRef ||
      health.qaRun !== target.run || health.edgeVersion !== pin.version ||
      health.release !== pin.businessVersion || health.build !== pin.businessVersion ||
      health.contract !== target.contract) {
    throw Error('ISOLATED_API_HEALTH_PAIR_MISMATCH');
  }
}

export async function checkIsolatedApiPair(root, fetcher = fetch) {
  const read = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
  const manifest = read('test/staging-manifest.json');
  const targets = read('config/canonical-db-targets.json');
  const pin = manifest.sh59IsolatedQa;
  const target = targets.isolatedQa;
  const pair = expectedReleasePair(manifest);
  if (!pair || !target || !pin ||
      target.run !== 'carrier124nov18' || target.projectRef !== targets.staging.projectRef ||
      target.projectRef === targets.production.projectRef ||
      !/^[a-z0-9]{20}$/.test(target.projectRef) ||
      pin.projectRef !== target.projectRef || pin.function !== 'freight-api-qa-' + target.run ||
      pin.schema !== 'freight_qa_' + target.run || pin.businessVersion !== manifest.primaryBusinessVersion) {
    throw Error('INVALID_ISOLATED_API_TARGET');
  }
  const api = 'https://' + target.projectRef + '.supabase.co/functions/v1/' + pin.function;
  async function request(path) {
    const started = performance.now();
    const response = await fetcher(api + path, {redirect: 'error', signal: AbortSignal.timeout(15000)});
    return {response, check: {path, status: response.status, durationMs: Math.round(performance.now() - started),
      requestId: response.headers.get('x-freight-request-id')}};
  }
  const health = await request('/health');
  if (health.response.status !== 200) throw Error('ISOLATED_API_HEALTH_HTTP_' + health.response.status);
  assertIsolatedHealth(await health.response.json(), pin, target);
  const protectedRoutes = ['/api/carrier', '/api/portal-feedback?view=notices'];
  const protectedChecks = await Promise.all(protectedRoutes.map(async path => {
    const {check} = await request(path);
    if (check.status !== 401 && check.status !== 403) throw Error('UNEXPECTED_ANONYMOUS_API_RESPONSE:' + path + ':' + check.status);
    return check;
  }));
  return {
    result: 'PASS',
    scope: 'ISOLATED_API_HEALTH_AND_ANONYMOUS_CONTRACT',
    primaryBusinessVersion: pin.businessVersion,
    backendSha: pin.sourceCommit,
    backendVersion: pin.version,
    sqlMigrationVersion: pair.sqlMigrationVersion,
    checks: [health.check, ...protectedChecks]
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    console.log(JSON.stringify(await checkIsolatedApiPair(resolve(import.meta.dirname, '..')), null, 2));
  } catch(error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
