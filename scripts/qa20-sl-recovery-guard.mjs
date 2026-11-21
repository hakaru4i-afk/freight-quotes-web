import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const login = 'carrier124nov18-carrierb';
const owner = 'carrier124nov18-owner';
const baseline = 79;
const anchorId = '821bd963-7605-4187-93b6-dec21b5b50fa';
const boundary = 'Controlled synthetic QA score for the acceptance boundary';
const boundaryRestore = 'Restore simulated Carrier B after acceptance test';
const recovery = 'Restore isolated synthetic Carrier B to its verified QA baseline';
const limits = [76, 75, 51, 50];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const orderFormats = [
  [/^QA-N26-OIDC-[1-9][0-9]+(?:-[1-9][0-9]*)?$/, order => 'Isolated QA OIDC ' + order],
  [/^QA-CI-[1-9][0-9]+-LATE-[A-F0-9]{8}$/, () => 'Synthetic API business acceptance']
];
const requestEvents = {
  no_response: {prefix:'response-missing:', delta:-3},
  timely_response: {prefix:'response-timely:', delta:0}
};

function number(value) {
  assert.ok(typeof value === 'number' || /^-?[0-9]+$/.test(value ?? ''), 'INVALID_QA_SL_LEDGER_NUMBER');
  const parsed = Number(value);
  assert.ok(Number.isSafeInteger(parsed), 'INVALID_QA_SL_LEDGER_NUMBER');
  return parsed;
}

// This is an audited anchor in the isolated fixture ledger. Later revisions
// are replayed, including interrupted tests and completed recoveries.
export function planCarrierBRecovery(current) {
  assert.ok(Array.isArray(current.corrections) && Array.isArray(current.events), 'INVALID_QA_SL_LEDGER');
  const anchorIndex = current.corrections.findIndex(row => row.id === anchorId);
  assert.ok(anchorIndex >= 0, 'MISSING_VERIFIED_SYNTHETIC_CARRIER_B_ANCHOR');
  const anchor = current.corrections[anchorIndex];
  assert.deepEqual([anchor.login, anchor.actor, anchor.action, number(anchor.revision), number(anchor.after_seq),
    number(anchor.value), number(anchor.score_before), number(anchor.score_after), anchor.event_id, anchor.reason],
  [login, owner, 'set_score', 38, 30, baseline, 64, baseline, null,
    'Restore audited isolated QA Carrier B synthetic no-response penalties after revision 37'], 'QA_SL_ANCHOR_CHANGED');

  const corrections = current.corrections.slice(anchorIndex + 1);
  const orders = new Map();
  const eventIds = new Set();
  const eventKeys = new Set();
  const correctionIds = new Set([anchorId]);
  let revision = number(anchor.revision);
  let sequence = number(anchor.after_seq);
  let score = baseline;
  let blocked = false;
  let boundaryStart;
  let boundaryLength = 0;
  let nextCorrection = 0;
  let lastEvent = current.events.find(event => number(event.seq) === sequence)?.id;
  assert.match(lastEvent ?? '', uuid, 'MISSING_QA_SL_ANCHOR_EVENT');

  function applyCorrections() {
    while (nextCorrection < corrections.length && number(corrections[nextCorrection].after_seq) === sequence) {
      const row = corrections[nextCorrection++];
      assert.match(row.id ?? '', uuid);
      assert.ok(!correctionIds.has(row.id), 'DUPLICATE_QA_SL_CORRECTION');
      correctionIds.add(row.id);
      assert.deepEqual([row.login, row.actor, row.action, row.event_id, number(row.revision)],
        [login, owner, 'set_score', null, ++revision], 'UNRECOGNIZED_QA_SL_CORRECTION');
      assert.equal(number(row.score_before), score, 'QA_SL_CORRECTION_BEFORE_DRIFT');
      const value = number(row.value);
      if (row.reason === boundary) {
        assert.equal(value, limits[boundaryLength], 'UNRECOGNIZED_QA_SL_BOUNDARY');
        if (!boundaryLength) boundaryStart = score;
        boundaryLength++;
      } else {
        assert.equal(blocked, false, 'QA_SL_UNLOCK_REQUIRED');
        if (row.reason === boundaryRestore) {
          assert.ok(boundaryLength, 'QA_SL_BOUNDARY_NOT_STARTED');
          assert.equal(value, boundaryStart, 'QA_SL_WRONG_BOUNDARY_BASELINE');
        } else {
          assert.equal(row.reason, recovery, 'UNRECOGNIZED_QA_SL_CORRECTION_REASON');
          assert.equal(value, baseline, 'QA_SL_WRONG_RECOVERY_BASELINE');
          assert.ok(score !== baseline || boundaryLength, 'UNNECESSARY_QA_SL_CORRECTION');
        }
        boundaryLength = 0;
      }
      score = value;
      blocked ||= score <= 50;
      assert.equal(number(row.score_after), score, 'QA_SL_CORRECTION_AFTER_DRIFT');
    }
  }

  applyCorrections();
  for (const event of current.events.filter(row => number(row.seq) > number(anchor.after_seq))) {
    assert.equal(number(event.seq), ++sequence, 'QA_SL_EVENT_SEQUENCE_DRIFT');
    assert.equal(event.login, login, 'QA_SL_EVENT_WRONG_ACCOUNT');
    assert.match(event.id ?? '', uuid);
    assert.ok(!eventIds.has(event.id) && !eventKeys.has(event.event_key), 'DUPLICATE_QA_SL_EVENT');
    eventIds.add(event.id);
    eventKeys.add(event.event_key);
    assert.equal(number(event.score_before), score, 'QA_SL_EVENT_BEFORE_DRIFT');
    assert.notEqual(event.corrected, true, 'UNRECOGNIZED_QA_SL_EVENT_CORRECTION');
    const delta = number(event.requested_delta);
    if (event.kind === 'owner_unlock') {
      assert.equal(blocked, true, 'QA_SL_UNEXPECTED_UNLOCK');
      assert.deepEqual([event.actor, event.source_kind, event.source_id, event.order_code, event.event_key],
        [owner, 'service', login, '', 'unlock:' + login + ':' + lastEvent], 'UNRECOGNIZED_QA_SL_UNLOCK');
      assert.ok(event.reason === recovery || (event.reason === boundaryRestore && boundaryLength), 'UNRECOGNIZED_QA_SL_UNLOCK_REASON');
      assert.equal(delta, Math.max(0, 51 - score), 'QA_SL_UNLOCK_DELTA_DRIFT');
      blocked = false;
    } else {
      const rule = requestEvents[event.kind];
      assert.ok(Object.hasOwn(requestEvents, event.kind), 'UNRECOGNIZED_QA_SL_EVENT');
      assert.deepEqual([event.actor, event.source_kind, delta], ['system', 'request', rule.delta], 'UNRECOGNIZED_QA_SL_EVENT_PROVENANCE');
      assert.ok(event.event_key?.startsWith(rule.prefix) && uuid.test(event.event_key.slice(rule.prefix.length)), 'QA_SL_EVENT_KEY_DRIFT');
      assert.match(event.source_id ?? '', uuid, 'QA_SL_REQUEST_ROUND_INVALID');
      const format = orderFormats.find(([pattern]) => pattern.test(event.order_code));
      assert.ok(format, 'QA_SL_ORDER_NOT_APPROVED');
      assert.ok(!orders.has(event.order_code), 'DUPLICATE_QA_SL_ORDER_EVENT');
      orders.set(event.order_code, {order:event.order_code, round:event.source_id, summary:format[1](event.order_code)});
    }
    lastEvent = event.id;
    score = Math.min(100, Math.max(0, score + delta));
    blocked ||= score <= 50;
    assert.equal(number(event.score_after), score, 'QA_SL_EVENT_AFTER_DRIFT');
    applyCorrections();
  }
  assert.equal(nextCorrection, corrections.length, 'QA_SL_CORRECTION_SEQUENCE_DRIFT');
  assert.equal(number(current.revision), revision, 'QA_SL_REVISION_DRIFT');
  assert.deepEqual([number(current.policy.score), current.policy.blocked], [score, blocked], 'QA_SL_POLICY_DRIFT');
  return {revision, sequence, score, blocked, recoveryRequired: blocked || score !== baseline || boundaryLength > 0,
    orders:[...orders.values()]};
}

export async function recoverVerifiedCarrierB(api, loadEvidence) {
  const state = async () => planCarrierBRecovery((await api('owner', '/api/service-level', {login})).json);
  async function verifiedState() {
    const first = await state();
    await Promise.all(first.orders.map(async expected => {
      const {json} = await api('owner', '/api/requests', {order:expected.order});
      const request = json?.request;
      assert.ok(request?.order_code===expected.order && request?.round_id===expected.round &&
        request?.summary===expected.summary, 'QA_SL_SYNTHETIC_REQUEST_READBACK_MISMATCH');
    }));
    assert.deepEqual(await state(), first, 'QA_SL_LEDGER_CHANGED_DURING_VERIFICATION');
    return first;
  }
  const original = await verifiedState();
  let current = original;
  if (current.blocked) {
    const files = await loadEvidence();
    assert.deepEqual(await verifiedState(), current, 'QA_SL_LEDGER_CHANGED_BEFORE_UNLOCK');
    await api('owner', '/api/service-level', {}, {login, action:'unlock', reason:recovery, ...files}, [200, 409]);
    current = await verifiedState();
    assert.equal(current.blocked, false, 'QA_SL_UNLOCK_NOT_CONFIRMED');
  }
  if (current.recoveryRequired) {
    const key = createHash('sha256').update(`${login}/${current.revision}/${current.sequence}`).digest('hex').slice(0,32);
    const requestId = key.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
    await api('owner', '/api/service-level', {}, {
      login, action:'set_score', value:baseline, reason:recovery, expectedRevision:current.revision, requestId
    }, [200, 409]);
    current = await verifiedState();
    assert.equal(current.recoveryRequired, false, 'QA_SL_RECOVERY_NOT_CONFIRMED');
  }
  return {recoveryRequired:original.recoveryRequired, initialScore:original.score, score:current.score, blocked:current.blocked,
    revision:current.revision, verifiedSyntheticOrders:current.orders.length};
}
