import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStagingPair, stagingIdentityAssets, stagingPairBytes} from '../../scripts/release/locked-qa-runtime.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const tenderCheck = 'competitive_tender_step_final_protocol_and_role_guard';
export const modeCheck = 'sea_air_multimodal_shipments_retain_actual_tracking_without_guessed_coordinates';
export const fixtureSummary = 'Synthetic API business acceptance';

export function fixtureOrder(order, runId, kind) {
  assert.match(runId ?? '', /^\d{1,18}$/, 'CURRENT_QA_RUN_ID_REQUIRED');
  assert.ok(order?.startsWith(`QA-CI-${runId}-${kind}-`), 'CURRENT_QA_FIXTURE_REQUIRED');
  assert.match(order.slice(order.lastIndexOf('-') + 1), /^[A-F0-9]{8}$/, 'INVALID_QA_FIXTURE_SUFFIX');
  assert.equal(order.split('-').length, 5, 'INVALID_QA_FIXTURE_ORDER');
  return order;
}

export function requireBusinessFixture(report, checkId, {runId, runAttempt, runtime}) {
  assert.deepEqual([report.runId, report.runAttempt, report.runtime], [runId, runAttempt, runtime], 'VERSION_MISMATCH:BUSINESS_FIXTURE_RUN');
  assert.equal(report.environment, 'isolated-qa');
  assert.equal(report.productionDataUsed, false);
  const check = report.checks.find(check => check.id === checkId);
  assert.equal(check?.status, 'PASS', `DATA_FIXTURE_ERROR:BUSINESS_CHECK_${checkId}`);
  return check.evidence;
}

// Resolve only the API slug attested by the published manifest. Never forward to production.
export function previousUiApiPath(url, publishedSlug = 'freight-api') {
  assert.match(publishedSlug, /^freight-api(?:-release-[a-f0-9]{32})?$/, 'INVALID_PUBLISHED_API_SLUG');
  const u = new URL(url);
  if (u.hostname === 'ooclsrndeygojtofuyte.supabase.co') {
    assert.equal(u.origin, 'https://ooclsrndeygojtofuyte.supabase.co', 'PRODUCTION_API_ORIGIN_MISMATCH');
    assert.ok(!u.username && !u.password, 'PRODUCTION_API_CREDENTIALS_IN_URL');
    const prefix = '/functions/v1/' + publishedSlug;
    assert.ok(u.pathname.startsWith(prefix + '/api/'), 'PRODUCTION_API_ROUTE_MISMATCH');
    return u.pathname.slice(prefix.length);
  }
  if (u.origin === 'https://hakaru4i-afk.github.io' && u.pathname.startsWith('/api/')) return u.pathname;
  return null;
}

export function previousUiSuppression(method, path) {
  if (method !== 'POST') return null;
  if (path === '/api/site-events') return 'telemetry';
  // The previous Carrier UI calculates route previews on load. The API can
  // write its route cache, so a read-only compatibility run blocks it locally.
  if (path === '/api/route-distance') return 'routeCalculation';
  return null;
}

export function latePenaltyCorrection({request, notification, ledger, login, order, round, runId}) {
  fixtureOrder(order, runId, 'LATE');
  assert.match(login, /^rc20261110-carrier[ab]$/, 'UNAPPROVED_QA_CARRIER');
  assert.match(round, uuid, 'INVALID_QA_FIXTURE_ROUND');
  assert.deepEqual([request.order_code, request.round_id, request.summary], [order, round, fixtureSummary], 'QA_REQUEST_PROVENANCE_MISMATCH');
  assert.deepEqual([notification.order_code, notification.round_id, notification.summary, notification.recipient],
    [order, round, fixtureSummary, login], 'QA_NOTIFICATION_PROVENANCE_MISMATCH');
  assert.match(notification.id, uuid, 'INVALID_QA_NOTIFICATION_ID');
  assert.equal(ledger.policy.login, login, 'QA_LEDGER_ACCOUNT_MISMATCH');
  const penalties = ledger.events.filter(event => event.order_code === order && event.kind === 'no_response');
  assert.ok(penalties.length <= 1, 'QA_MULTIPLE_FIXTURE_PENALTIES');
  const [event] = penalties;
  if (!event) return null;
  assert.match(event.id, uuid, 'INVALID_QA_PENALTY_ID');
  assert.deepEqual([event.login, event.actor, event.source_kind, event.source_id, event.event_key],
    [login, 'system', 'request', round, 'response-missing:' + notification.id], 'QA_PENALTY_PROVENANCE_MISMATCH');
  if (event.corrected) {
    // Replay replaces requested_delta with the effective correction; original_delta retains the historical penalty.
    assert.equal(Number(event.original_delta), -3, 'QA_PENALTY_PROVENANCE_MISMATCH');
    assert.deepEqual([Number(event.requested_delta), Number(event.delta)], [0, 0], 'QA_PENALTY_NOT_NEUTRALIZED');
    const latest = (ledger.corrections ?? []).filter(c => c.event_id === event.id)
      .sort((a,b) => Number(a.revision) - Number(b.revision)).at(-1);
    assert.ok(latest && latest.login === login && latest.action === 'void_event' && Number(latest.value) === 0,
      'QA_FIXTURE_CORRECTION_RECEIPT_MISSING');
    return null;
  }
  assert.equal(Number(event.requested_delta), -3, 'QA_PENALTY_PROVENANCE_MISMATCH');
  assert.ok(Number.isSafeInteger(ledger.revision) && ledger.revision >= 0, 'INVALID_QA_LEDGER_REVISION');
  const key = createHash('sha256').update(`isolated-qa/late-fixture/${login}/${event.id}`).digest('hex').slice(0, 32);
  return {
    login, action: 'void_event', eventId: event.id,
    expectedRevision: ledger.revision,
    requestId: key.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5'),
    reason: `Neutralize test-only forced deadline for ${order} after acceptance assertions`,
  };
}

 // The receipt is generated by the protected staging workflow, never tracked in Git.
 // Reconstruct it from independently attested provider identity and frozen source bytes.
export function browserRuntimeReceipt(frontend, runtime, frontendSha) {
  assert.equal(runtime?.frontendSha, frontendSha, 'BROWSER_RUNTIME_FRONTEND_MISMATCH');
  assert.equal(runtime.backendSha, runtime.sourceCommit, 'BROWSER_RUNTIME_BACKEND_MISMATCH');
  assert.deepEqual([runtime.function,runtime.version,runtime.bundle],
    [runtime.deployment?.function,runtime.deployment?.version,runtime.deployment?.bundle], 'BROWSER_RUNTIME_DEPLOYMENT_MISMATCH');
  const pair = createStagingPair({frontendSha, backendSha:runtime.backendSha},runtime.deployment,stagingIdentityAssets(frontend));
  assert.deepEqual(runtime.activeRuntimePair,pair,'BROWSER_RUNTIME_RECEIPT_MISMATCH');
  return stagingPairBytes(pair);
}
export function isolatedHealthRequest(url, method, qaFunction) {
  const u = new URL(url);
  return method==='GET' && /^freight-api-qa-(?:rc20261110|carrier124nov18)$/.test(qaFunction) &&
    u.origin==='https://ibclzdkxiozbzmniiygv.supabase.co' &&
    !u.username && !u.password && u.pathname==='/functions/v1/'+qaFunction+'/health';
}
export function verifyBrowserHealth(health,runtime) {
  assert.equal(health?.ok,true,'BROWSER_HEALTH_NOT_OK');
  if(runtime?.activeRuntimePair){
    const pair=runtime.activeRuntimePair;
    assert.deepEqual([health.environment,health.projectRef,health.qaRun,health.backendSha,health.deploymentId],
      ['staging',pair.apiProject,'rc20261110',pair.backendSha,pair.apiDeploymentId],'BROWSER_HEALTH_RUNTIME_MISMATCH');
  }
}
