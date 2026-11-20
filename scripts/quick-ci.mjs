import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';

const frontend = {
  release: ['staging-alignment', 'staging-asset-cache', 'canonical-db-targets', 'task12-release-gate', 'quick-ci'],
  orders: ['carrier124-owner-request-fields', 'carrier124-refresh-parity', 'issue47-bid-edit-route',
    'issue47-carrier-workspace-deadlines', 'issue47-carrier-xlsx', 'issue47-late-ui', 'owner-offer-scoring-r3'],
  execution: ['global-view-route', 'map-geocode-fallback', 'map50-carrier-station-ui-contract',
    'map50-owner-km-before-bid', 'task2-busy-actions', 'task2-detail-selection', 'task2-one-container-docs-20261114',
    'task2-request-coalescing', 'owner-pto-review-task-order', 'ved-shared-chat-and-requests'],
  roles: ['issue47-agreed-roles-and-owner-registers', 'issue47-help-locales', 'lw-pending-tasks-all-roles',
    'owner-development-progress', 'owner-register-publication', 'qa-artifact-privacy', 'task12-ci-environment-policy']
};

const backend = {
  release: ['candidate-alignment', 'database-target', 'qa-isolation-build', 'qa-oidc-policy',
    'release-production-api-version-package'],
  orders: ['carrier-dashboard', 'carrier124-owner-request-contract', 'carrier124-registration-schema-scoped',
    'request-identity', 'task1-publication-contract', 'tender-visibility'],
  execution: ['geocoding', 'map-geocode-integration', 'offline-catalog-importer', 'rail-station-geocoding',
    'shipment-geocoding', 'task2-accepted-visibility', 'task2-manual-pto-review', 'task2-nov14-critical', 'task2-plan-limit',
    'task2-road-checkpoint', 'task2-dashboard-projection'],
  roles: ['engineering-registers', 'owner-register-work', 'partner-inquiry-isolation',
    'pending-tasks', 'portal-feedback-idempotency', 'role-development-notices', 'task2-addressed-logistic']
};

export function selectQuickChecks(side, paths) {
  if (side !== 'frontend' && side !== 'backend') throw Error('INVALID_CI_REPOSITORY');
  const suites = side === 'frontend' ? frontend : backend;
  const groups = new Set(['release']);
  const changedTests = [];
  let fullAcceptance = false;
  let recovery = false;

  for (const path of paths) {
    if (/^tests\/[^/]+\.test\.mjs$/.test(path)) {
      changedTests.push(path);
      continue;
    }
    if (/^(?:docs\/|\.github\/PULL_REQUEST_TEMPLATE\.md$)/.test(path)) continue;
    if (/^(?:supabase\/migrations\/|scripts\/qa\/migrations\/|recovery\/|scripts\/backup\/|scripts\/release\/pending\/|release\/)/.test(path)) {
      recovery = true;
      fullAcceptance = true;
      ['orders','execution','roles'].forEach(group => groups.add(group));
    } else if (/^(?:test\/)?(?:global-view\/|task2(?:[-.]|\.ts$))|^src\/transport-application\/(?:shipment-geocoding|shipment-geopoints|geocoding|task2)(?:\.|-)/.test(path) ||
        /^scripts\/geo\//.test(path)) {
      groups.add('execution');
      fullAcceptance = true;
    } else if (/^(?:test\/)?(?:late-bid|offer-scoring|carrier-dashboard)|^src\/transport-application\/(?:carrier-dashboard|tender-visibility|offer-scoring|late-bid-drafts)\./.test(path)) {
      groups.add('orders');
      fullAcceptance = true;
    } else if (/^(?:test\/)?(?:owner-register|role-help)|^src\/transport-application\/(?:engineering-registers|owner-register-work|pending-tasks|registry-publication)\./.test(path)) {
      groups.add('roles');
      fullAcceptance = true;
    } else if (/^(?:config\/canonical-db-targets\.json$|\.github\/workflows\/.*(?:oidc|recovery|backup).+\.yml$)/.test(path)) {
      ['orders','execution','roles'].forEach(group => groups.add(group));
      fullAcceptance = true;
    } else if (!/^(?:config\/|scripts\/release\/|scripts\/(?:check-|reindex-|stamp-|quick-ci|release-evidence|staging-dependencies|assess-authenticated-acceptance)|\.github\/workflows\/|test\/(?:build-info|staging-manifest|site-status|qa-robot-latest|qa-release-readiness)\.json$|staging-manifest\.json$)/.test(path)) {
      // Shared entry points and uncovered paths can affect every group.
      ['orders','execution','roles'].forEach(group => groups.add(group));
      fullAcceptance = true;
    }
  }

  const tests = [...groups].flatMap(group => suites[group].map(name => 'tests/' + name + '.test.mjs'));
  return {groups: [...groups].sort(), tests: [...new Set([...tests, ...changedTests])].sort(),
    requiredTests: tests, fullAcceptance, recovery};
}

function revision(root, ref) {
  if (!(ref === 'HEAD' || /^[a-f0-9]{40}$/.test(ref))) throw Error('CI_REQUIRES_EXPLICIT_GIT_SHA');
  return execFileSync('git', ['rev-parse', '--verify', ref + '^{commit}'], {cwd:root, encoding:'utf8'}).trim();
}

function check(side, root, baseRef, execute) {
  const base = revision(root, baseRef);
  const head = revision(root, 'HEAD');
  const paths = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, head], {cwd:root})
    .toString().split('\0').filter(Boolean);
  const plan = selectQuickChecks(side, paths);
  const started = performance.now();
  if (!execute) return {...plan, side, base, head, paths};
  execFileSync('git',['diff','--exit-code','HEAD'],{cwd:root,stdio:['ignore','ignore','inherit']});
  // Run against the checkout being reported. Removed test paths are excluded by Git.
  const tracked = new Set(execFileSync('git', ['ls-files', '-z', 'tests'], {cwd:root})
    .toString().split('\0'));
  const missing = plan.requiredTests.filter(path => !tracked.has(path));
  if (missing.length) throw Error('QUICK_CI_REQUIRED_TEST_MISSING:' + missing.join(','));
  const tests = plan.tests.filter(path => tracked.has(path));
  const run = spawnSync(process.execPath, ['--test', ...tests], {cwd:root, stdio:'inherit'});
  return {...plan, tests, side, base, head, paths,
    result: run.status === 0 ? 'PASS' : 'FAIL', durationMs:Math.round(performance.now() - started)};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const option = name => args.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  const execute = !args.includes('--plan');
  const root = resolve(import.meta.dirname, '..');
  const frontendResult = check('frontend', root, option('base'), execute);
  const backendRoot = option('backend-root');
  const backendResult = backendRoot ? check('backend', resolve(backendRoot), option('backend-base'), execute) : null;
  const checks = [frontendResult, backendResult].filter(Boolean);
  const report = {scope:'QUICK_SOURCE_REGRESSION', fullAcceptanceRequired: checks.some(c=>c.fullAcceptance),
    recoveryRequired: checks.some(c=>c.recovery), checks};
  const output = option('report');
  if (output) {
    mkdirSync(dirname(output), {recursive:true});
    writeFileSync(output, JSON.stringify(report,null,2) + '\n');
  }
  console.log(JSON.stringify(report,null,2));
  if (checks.some(c=>c.result==='FAIL')) process.exitCode=1;
}
