import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fixtureSummary,latePenaltyCorrection,modeCheck,previousUiSuppression,requireBusinessFixture,tenderCheck} from './helpers/isolated-qa-acceptance.mjs';

const runId = '45648242961';
const runAttempt = '2';
const runtime = {frontendSha: 'web', backendSha: 'api', bundle: 'digest'};
const source = {runId, runAttempt, runtime};
const business = {
  ...source, environment: 'isolated-qa', productionDataUsed: false,
  checks: [{id:tenderCheck, status:'PASS', evidence:{order:`QA-CI-${runId}-TENDER-ABCDEF12`}}, {id:modeCheck, status:'FAIL'}],
};

test('browser acceptance needs a successful fixture from the current run, attempt and runtime', () => {
  assert.equal(requireBusinessFixture(business,tenderCheck,source).order, `QA-CI-${runId}-TENDER-ABCDEF12`);
  for (const drift of [{runId:'1234'}, {runAttempt:'1'}, {runtime:{...runtime,bundle:'other'}}]) {
    assert.throws(() => requireBusinessFixture(business,tenderCheck,{...source,...drift}), /VERSION_MISMATCH:BUSINESS_FIXTURE_RUN/);
  }
  assert.throws(() => requireBusinessFixture(business,modeCheck,source), /DATA_FIXTURE_ERROR:BUSINESS_CHECK/);
  assert.throws(() => requireBusinessFixture({...business,productionDataUsed:true},tenderCheck,source));
});

test('compatibility suppresses only the two expected background posts before any forwarding', () => {
  assert.equal(previousUiSuppression('POST','/api/site-events'), 'telemetry');
  assert.equal(previousUiSuppression('POST','/api/route-distance'), 'routeCalculation');
  for (const path of ['/api/route-distance/update', '/api/requests', '/api/task2', null]) assert.equal(previousUiSuppression('POST',path),null);
  assert.equal(previousUiSuppression('PATCH','/api/route-distance'),null);
  assert.equal(previousUiSuppression('GET','/api/route-distance'),null);
});

function lateFixture() {
  const order = `QA-CI-${runId}-LATE-ABCDEF12`;
  const round = '0f1d1ea3-61c8-4303-a724-d7cb84d9c845';
  const notificationId = '60ab8605-e6e0-4dc8-a95f-84e4e5c12084';
  const login = 'rc20261110-carriera';
  const event = {
    id:'581be892-49a6-451c-be28-f7cd34c7e95f', login, order_code:order, kind:'no_response', actor:'system',
    source_kind:'request', source_id:round, event_key:`response-missing:${notificationId}`, requested_delta:-3, delta:-3,
  };
  return {
    order, round, login, runId,
    request:{order_code:order, round_id:round, summary:fixtureSummary},
    notification:{order_code:order, round_id:round, summary:fixtureSummary, id:notificationId, recipient:login},
    ledger:{policy:{login}, events:[event], revision:7},
  };
}

test('forced deadline cleanup neutralizes the exact synthetic penalty with an idempotent audited action', () => {
  const fixture = lateFixture();
  const command = latePenaltyCorrection(fixture);
  assert.equal(command.action,'void_event');
  assert.equal(command.login,fixture.login);
  assert.equal(command.eventId,fixture.ledger.events[0].id);
  assert.equal(command.expectedRevision,7);
  assert.deepEqual(latePenaltyCorrection(fixture),command);
  const [event] = fixture.ledger.events;
  fixture.ledger.events = [{...event,corrected:true,delta:0}];
  assert.equal(latePenaltyCorrection(fixture),null);
});

test('fixture cleanup rejects foreign requests, notifications, ledger identities and event provenance', () => {
  const fixture = lateFixture();
  assert.throws(() => latePenaltyCorrection({...fixture,runId:'1234'}), /CURRENT_QA_FIXTURE_REQUIRED/);
  assert.throws(() => latePenaltyCorrection({...fixture,login:'carrier'}), /UNAPPROVED_QA_CARRIER/);
  assert.throws(() => latePenaltyCorrection({...fixture,request:{...fixture.request,summary:'other'}}), /QA_REQUEST_PROVENANCE_MISMATCH/);
  assert.throws(() => latePenaltyCorrection({...fixture,notification:{...fixture.notification,recipient:'rc20261110-carrierb'}}), /QA_NOTIFICATION_PROVENANCE_MISMATCH/);
  assert.throws(() => latePenaltyCorrection({...fixture,ledger:{...fixture.ledger,policy:{login:'rc20261110-carrierb'}}}), /QA_LEDGER_ACCOUNT_MISMATCH/);
  const [event] = fixture.ledger.events;
  fixture.ledger.events = [{...event,source_id:event.id}];
  assert.throws(() => latePenaltyCorrection(fixture), /QA_PENALTY_PROVENANCE_MISMATCH/);
  fixture.ledger.events = [event,event];
  assert.throws(() => latePenaltyCorrection(fixture), /QA_MULTIPLE_FIXTURE_PENALTIES/);
  fixture.ledger.events = [];
  assert.equal(latePenaltyCorrection(fixture),null);
});

test('fixture policy preflight precedes Chromium and dependent checks cannot use a failed fixture', () => {
  const workflow = readFileSync('.github/workflows/isolated-qa-oidc-browser.yml','utf8');
  const preflight = workflow.indexOf('node tests/task12-business-api.e2e.mjs --preflight');
  assert.ok(preflight > workflow.indexOf('node tests/task12-ci-auth.mjs') && preflight < workflow.indexOf('npx playwright install'));
  assert.match(workflow,/id: mode_matrix\n\s+if: steps\.business_api\.outputs\.mode_ready == 'true'/);
  assert.match(workflow,/id: tender_pdf\n\s+if: steps\.business_api\.outputs\.tender_ready == 'true'/);
});
