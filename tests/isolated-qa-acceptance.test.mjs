import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStagingPair,stagingIdentityAssets,stagingPairBytes} from '../scripts/release/locked-qa-runtime.mjs';
import test from 'node:test';
import {fixtureSummary,latePenaltyCorrection,modeCheck,previousUiApiPath,previousUiSuppression,requireBusinessFixture,tenderCheck,browserRuntimeReceipt,isolatedHealthRequest,verifyBrowserHealth} from './helpers/isolated-qa-acceptance.mjs';

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
  fixture.ledger.events = [{...event,corrected:true,original_delta:-3,requested_delta:0,delta:0}];
  const receipt = {id:command.requestId,event_id:event.id,login:fixture.login,revision:8,action:'void_event',value:0};
  fixture.ledger.corrections = [receipt];
  assert.equal(latePenaltyCorrection(fixture),null);
  fixture.ledger.corrections = [];
  assert.throws(() => latePenaltyCorrection(fixture), /QA_FIXTURE_CORRECTION_RECEIPT_MISSING/);
  fixture.ledger.corrections = [receipt,{...receipt,revision:9,action:'adjust_event'}];
  assert.throws(() => latePenaltyCorrection(fixture), /QA_FIXTURE_CORRECTION_RECEIPT_MISSING/);
  fixture.ledger.corrections = [receipt];
  fixture.ledger.events = [{...event,corrected:true,original_delta:-5,requested_delta:0,delta:0}];
  assert.throws(() => latePenaltyCorrection(fixture), /QA_PENALTY_PROVENANCE_MISMATCH/);
  fixture.ledger.events = [{...event,corrected:true,original_delta:-3,requested_delta:0,delta:-1}];
  assert.throws(() => latePenaltyCorrection(fixture), /QA_PENALTY_NOT_NEUTRALIZED/);
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


test('previous production compatibility routes the attested legacy or immutable slug to the isolated API',()=>{
 const host='https://ooclsrndeygojtofuyte.supabase.co/functions/v1/';
 const slug='freight-api-release-50cbee0bfac84e62b1eafee17012491e';
 for(const name of ['freight-api',slug]){
  for(const endpoint of ['session','data','carrier','site-events','route-distance']){
   assert.equal(previousUiApiPath(host+name+'/api/'+endpoint+'?forceFunctionRegion=eu-central-1',name),'/api/'+endpoint);
  }
  assert.equal(previousUiSuppression('POST',previousUiApiPath(host+name+'/api/site-events',name)),'telemetry');
  assert.equal(previousUiSuppression('POST',previousUiApiPath(host+name+'/api/route-distance',name)),'routeCalculation');
 }
 assert.equal(previousUiApiPath('https://hakaru4i-afk.github.io/api/data',slug),'/api/data');
 assert.equal(previousUiApiPath('https://hakaru4i-afk.github.io/freight-quotes-web/app.js',slug),null);
 assert.equal(previousUiApiPath('https://example.com/api/session',slug),null);
 for(const name of ['freight-api','freight-api-release-'+'a'.repeat(32),'freight-api-release-bad',slug+'-other']){
  assert.throws(()=>previousUiApiPath(host+name+'/api/session',slug),/PRODUCTION_API_ROUTE_MISMATCH/);
 }
 assert.throws(()=>previousUiApiPath(host+slug+'/health',slug),/PRODUCTION_API_ROUTE_MISMATCH/);
 assert.throws(()=>previousUiApiPath(host+slug+'/api/session','invalid'),/INVALID_PUBLISHED_API_SLUG/);
 const script=readFileSync('tests/production-previous-ui-compatibility.e2e.mjs','utf8');
 assert.match(script,/JSON\.parse\(manifest\)\.apiFunction/);
 assert.match(script,/previousUiApiPath\(u,publishedSlug\)/);
 assert.doesNotMatch(script,/\.split\('\/freight-api'\)/);
});

test('generated active staging receipt is reconstructed only from exact frozen source and attested deployment',t=>{
 const root=mkdtempSync(join(tmpdir(),'qa-receipt-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'test'));
 const project='ibclzdkxiozbzmniiygv',fn='freight-api-qa-rc20261110',sha='a'.repeat(40),backend='b'.repeat(40),build='c'.repeat(20),v='SH-01.30.59 v';
 const assets={'index.html':'index','app.js':'app','style.css':'css','build-info.json':{environment:'staging',primaryBusinessVersion:v,stagingAssetBuildId:build,version:build},'staging-manifest.json':{environment:'staging',primaryBusinessVersion:v},'site-status.json':{environment:'staging',version:build,release:{version:v}},'release-status.json':{version:v},'staging-transport-20261111.js':'LOCKED_STAGING_ISOLATION_V1'};
 for(const [n,x] of Object.entries(assets))writeFileSync(join(root,'test',n),typeof x==='string'?x:JSON.stringify(x));
 const lock={frontendSha:sha,backendSha:backend},deployment={project,function:fn,id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',version:55,bundle:'d'.repeat(64)};
 const pair=createStagingPair(lock,deployment,stagingIdentityAssets(root));
 const runtime={...lock,sourceCommit:backend,function:fn,version:55,bundle:deployment.bundle,deployment,activeRuntimePair:pair};
 assert.deepEqual(browserRuntimeReceipt(root,runtime,sha),stagingPairBytes(pair));
 assert.throws(()=>browserRuntimeReceipt(root,{...runtime,activeRuntimePair:undefined},sha),/BROWSER_RUNTIME_RECEIPT_MISMATCH/);
 assert.throws(()=>browserRuntimeReceipt(root,{...runtime,version:56},sha),/BROWSER_RUNTIME_DEPLOYMENT_MISMATCH/);
 assert.throws(()=>browserRuntimeReceipt(root,runtime,'e'.repeat(40)),/BROWSER_RUNTIME_FRONTEND_MISMATCH/);
 writeFileSync(join(root,'test/app.js'),'drift');
 assert.throws(()=>browserRuntimeReceipt(root,runtime,sha),/BROWSER_RUNTIME_RECEIPT_MISMATCH/);
 const health={ok:true,environment:'staging',projectRef:project,qaRun:'rc20261110',backendSha:backend,deploymentId:pair.apiDeploymentId};
 verifyBrowserHealth(health,runtime);
 assert.throws(()=>verifyBrowserHealth({...health,deploymentId:'different'},runtime),/BROWSER_HEALTH_RUNTIME_MISMATCH/);
 const url='https://'+project+'.supabase.co/functions/v1/'+fn+'/health?t=1';
 assert.equal(isolatedHealthRequest(url,'GET',fn),true);
 for(const u of [url.replace(project,'ooclsrndeygojtofuyte'),url.replace(fn,'freight-api'),url.replace('/health','/api/session'),url.replace('https:','http:')])assert.equal(isolatedHealthRequest(u,'GET',fn),false);
 assert.equal(isolatedHealthRequest(url,'POST',fn),false);
});
