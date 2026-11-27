import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStagingPair, stagingIdentityAssets, stagingPairBytes} from '../../scripts/release/locked-qa-runtime.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const tenderCheck = 'competitive_tender_step_final_protocol_and_role_guard';
export const modeCheck = 'sea_air_multimodal_shipments_retain_actual_tracking_without_guessed_coordinates';
export const sessionPolicyCheck = 'two_sessions_and_three_wrong_passwords';
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

export function requireAuditEvidenceContext(report, {runId, runAttempt, runtime}) {
  assert.match(runId ?? '', /^\d+$/, 'AUDIT_RUN_ID_REQUIRED');
  assert.match(runAttempt ?? '', /^[1-9]\d*$/, 'AUDIT_RUN_ATTEMPT_REQUIRED');
  const identity = value => [value.frontendSha, value.backendSha, value.function, value.version, value.bundle];
  assert.deepEqual([report.runId, report.runAttempt, ...identity(report.runtime ?? {})],
    [runId, runAttempt, ...identity(runtime)], 'AUDIT_EVIDENCE_CONTEXT_MISMATCH');
}

export function assertQaSession({status, data}, role, label) {
  assert.deepEqual([status, data?.authenticated, data?.role], [200, role !== null, role], label);
}

export function requireCertificationAuditEvidence(report, context) {
  requireAuditEvidenceContext(report, context);
  assert.equal(report.result, 'PASS', 'CERTIFICATION_AUDIT_BUSINESS_REPORT_FAILED');
  assert.equal(report.checks.filter(check => check.id === sessionPolicyCheck).length, 1, 'CERTIFICATION_AUDIT_CHECK_NOT_UNIQUE');
  const evidence = requireBusinessFixture(report, sessionPolicyCheck, context);
  assert.equal(evidence?.oldSessionRevoked, true, 'CERTIFICATION_AUDIT_REVOCATION_MISSING');
  const {before, after} = evidence.auditDenials ?? {};
  const ids = [before?.sessionRequestId, before?.requestId, after?.sessionRequestId, after?.requestId];
  for (const id of ids) assert.match(id ?? '', uuid, 'CERTIFICATION_AUDIT_REQUEST_ID_MISSING');
  assert.equal(new Set(ids).size, ids.length, 'CERTIFICATION_AUDIT_REQUEST_ID_REUSED');
  assert.ok(Array.isArray(report.calls), 'CERTIFICATION_AUDIT_CALLS_MISSING');
  const calls = ids.map(id => {
    const matches = report.calls.filter(call => call.requestId === id);
    assert.equal(matches.length, 1, 'CERTIFICATION_AUDIT_REQUEST_NOT_UNIQUE');
    const [call] = matches;
    assert.deepEqual([call.actor, call.method], ['certification', 'GET'], 'CERTIFICATION_AUDIT_REQUEST_MISMATCH');
    return call;
  });
  const [active, deniedActive, revoked, deniedRevoked] = calls;
  assert.deepEqual([active.path, active.status, active.authenticated, active.role],
    ['/api/session', 200, true, 'certification'], 'CERTIFICATION_AUDIT_ACTIVE_SESSION_MISMATCH');
  assert.deepEqual([revoked.path, revoked.status, revoked.authenticated, revoked.role],
    ['/api/session', 200, false, null], 'CERTIFICATION_AUDIT_REVOKED_SESSION_MISMATCH');
  for (const denial of [deniedActive, deniedRevoked]) {
    assert.deepEqual([denial.path, denial.status], ['/api/site-monitor', 403], 'CERTIFICATION_AUDIT_DENIAL_MISMATCH');
  }
  assert.deepEqual(report.calls.filter(call => call.actor === 'certification' && call.path === '/api/site-monitor').map(call => call.requestId),
    [before.requestId, after.requestId], 'CERTIFICATION_AUDIT_DENIAL_ORDER');
  assert.deepEqual(report.calls.filter(call => ids.includes(call.requestId)), calls, 'CERTIFICATION_AUDIT_REQUEST_ORDER');
  return {before: before.requestId, after: after.requestId};
}

export function expectAuditRequest(required, id, expected) {
  assert.match(id ?? '', uuid, 'AUDIT_REQUEST_ID_MISSING:' + expected.label);
  assert.ok(!required.has(id), 'AUDIT_REQUEST_ID_REUSED:' + expected.label);
  required.set(id, expected);
}

export function verifyAuditRecord(row, expected, actors) {
  const {label} = expected;
  const identity = expected.sessionState === 'revoked' ? {login: '', role: ''} : actors[expected.actor];
  const detail = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail;
  assert.equal(row.actor, identity.login, label + ': actor');
  assert.equal(row.role, identity.role, label + ': role');
  assert.equal(row.source, 'server', label + ': source');
  assert.equal(row.path, expected.path, label + ': path');
  assert.equal(Number(row.status), expected.status, label + ': status');
  assert.match(detail.reasonCode ?? '', /^[A-Z0-9_]+$/, label + ': reason');
  if (expected.kind) assert.equal(row.kind, expected.kind, label + ': kind');
  if (expected.reasonCode) assert.equal(detail.reasonCode, expected.reasonCode, label + ': reason code');
  if (expected.action) assert.equal(row.action, expected.action, label + ': action');
  if (expected.phase) assert.equal(detail.phase, expected.phase, label + ': phase');
  if (expected.serverCode) assert.equal(detail.serverCode, expected.serverCode, label + ': server code');
  if (expected.sessionState) assert.equal(detail.effectiveRole, identity.role || undefined, label + ': effective role');
  return {label, role: row.role, path: row.path, status: Number(row.status), kind: row.kind,
    reasonCode: detail.reasonCode, requestId: row.request_id,
    ...(expected.sessionState ? {sessionState: expected.sessionState, actor: row.actor} : {})};
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

 // An acknowledged read is also POST /api/chats, but the server intentionally
 // excludes routine read receipts from its business audit. Never select by verb alone.
export function requireChatSendAuditEvidence(report, context) {
  requireAuditEvidenceContext({...report,runtime:{frontendSha:report.frontendSha,
    backendSha:report.backendSourceCommit,function:report.backendFunction,
    version:report.backendVersion,bundle:report.backendBundle}},context);
  assert.equal(report.environment,'isolated-qa-rc20261110','CHAT_AUDIT_ENVIRONMENT');
  assert.equal(report.scenario,'ved-work','CHAT_AUDIT_SCENARIO');
  assert.equal(report.mocks,false,'CHAT_AUDIT_REAL_BROWSER_REQUIRED');
  assert.equal(report.immutableSource,true,'CHAT_AUDIT_FROZEN_SOURCE_REQUIRED');
  assert.equal(report.roles?.length,1,'CHAT_AUDIT_ROLE_COUNT');
  const [role]=report.roles;
  assert.deepEqual([role.actor,role.status],['ved','PASS'],'CHAT_AUDIT_ROLE');
  const chat=role.sharedChat;
  assert.deepEqual([chat?.http,chat?.manualMessages,chat?.files,chat?.realRecipients,chat?.loserDenied,chat?.automaticTemplates],
    [200,1,1,3,true,0],'CHAT_AUDIT_MESSAGE_READBACK_REQUIRED');
  assert.match(chat.sendRequestId??'',uuid,'CHAT_SEND_REQUEST_ID_REQUIRED');
  const matching=report.calls.filter(call=>call.requestId===chat.sendRequestId);
  assert.equal(matching.length,1,'CHAT_SEND_REQUEST_ID_NOT_UNIQUE');
  const [call]=matching;
  assert.deepEqual([call.actor,call.path,call.method,call.status,call.chatOperation],
    ['ved','/api/chats','POST',200,'send'],'CHAT_SEND_HTTP_EVIDENCE_MISMATCH');
  return chat.sendRequestId;
}
