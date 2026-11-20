import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectProductionGate} from '../scripts/release/production-gate.mjs';

const WEB='a'.repeat(40),API='b'.repeat(40),BUNDLE='c'.repeat(64),BACKUP='d'.repeat(64);
const ownerText='APPROVE SH59 FRONTEND='+WEB+' BACKEND='+API;
function valid(){
  const run=(repository,sha,id)=>({repository,head_sha:sha,status:'completed',conclusion:'success',event:'workflow_dispatch',id,updated_at:'2026-11-20T16:00:00Z'});
  return {
    context:{event:'workflow_dispatch',actor:'hakaru4i-afk',repository:'hakaru4i-afk/freight-quotes-web',ref:'refs/heads/main',checkoutSha:WEB,mainSha:WEB},
    target:{frontendSha:WEB,backendSha:API,businessVersion:'SH-01.30.59 v'},
    manifest:{environment:'production',businessVersion:'SH-01.30.59 v',frontendBuild:'unit-build'},
    build:{environment:'production',releaseVersion:'SH-01.30.59 v',build:'unit-build'},
    stage:{primaryBusinessVersion:'SH-01.30.59 v'},
    runs:{frontend:run('hakaru4i-afk/freight-quotes-web',WEB,1),backend:run('hakaru4i-afk/freight-quotes',API,2),e2e:run('hakaru4i-afk/freight-quotes-web',WEB,3),recovery:run('hakaru4i-afk/freight-quotes',API,4)},
    reports:{pair:{frontendSha:WEB,backendSha:API,apiBundleSha256:BUNDLE,servedFrontendSha:WEB,servedApiVerified:true},
      regression:{frontendSha:WEB,result:'PASS',groupCount:37,allTestsPassed:true},
      backend:{backendSha:API,result:'PASS',rbacRls:'PASS',schemaTransition:'PASS'},
      e2e:{authorized:true,environment:'isolated-qa',frontendSha:WEB,backendSha:API,criticalDefects:[],scenarios:[...Array.from({length:11},(_,i)=>'T1-'+String(i+1).padStart(2,'0')),...Array.from({length:26},(_,i)=>'T2-'+String(i+1).padStart(2,'0'))].map(id=>({id,status:'PASS',mode:'AUTHENTICATED_QA_API',actorRole:'owner',evidence:{method:'HTTP_AND_BROWSER',responseVerified:true,traceId:'synthetic-'+id}}))},
      backup:{result:'PASS',source:'production',encrypted:true,readbackSha256:true,sha256:BACKUP,databaseCaptured:true,storageCaptured:true},
      restore:{result:'PASS',backendSha:API,databaseRestored:true,storageRestored:true,isolationVerified:true,verifiedRollback:true,sourceBackupSha256:BACKUP}},
    ownerComment:{user:{login:'hakaru4i-afk'},body:ownerText,created_at:'2026-11-20T16:02:00Z'}
  };
}
test('baseline synthetic packet validates (does not deploy)',()=>{assert.equal(inspectProductionGate(valid()).allowed,true)});
test('wrong backend SHA blocks publication even when claims say PASS',()=>{const x=valid();x.target.backendSha='e'.repeat(40);const r=inspectProductionGate(x);assert.equal(r.allowed,false);assert.ok(r.blockers.includes('VERIFIED_GITHUB_RUN_BACKEND'));assert.ok(r.blockers.includes('PROVENANCE_PAIR'))});
test('old frontend SHA blocks publication',()=>{const x=valid();x.context.mainSha='f'.repeat(40);assert.ok(inspectProductionGate(x).blockers.includes('EXACT_SHA_AND_MAIN_HEAD'))});
test('36 of 37 authenticated cases blocks',()=>{const x=valid();x.reports.e2e.scenarios.pop();assert.ok(inspectProductionGate(x).blockers.includes('AUTHORIZED_37_OF_37'))});
test('synthetic E2E cannot pass',()=>{const x=valid();x.reports.e2e.scenarios[0].mode='MOCKED_BROWSER';assert.ok(inspectProductionGate(x).blockers.includes('AUTHORIZED_37_OF_37'))});
test('restore without Storage blocks',()=>{const x=valid();x.reports.restore.storageRestored=false;assert.ok(inspectProductionGate(x).blockers.includes('INDEPENDENT_RESTORE_AND_ROLLBACK'))});
test('approval for different SHA by other person blocks',()=>{const x=valid();x.ownerComment.body='APPROVE ANY';x.ownerComment.user.login='someoneelse';assert.ok(inspectProductionGate(x).blockers.includes('EXPLICIT_OWNER_APPROVAL'))});
test('branch push is not authorization',()=>{const x=valid();x.context.event='push';assert.ok(inspectProductionGate(x).blockers.includes('MANUAL_OWNER_MAIN_ONLY'))});
test('missing backend run fails closed',()=>{const x=valid();delete x.runs.backend;assert.ok(inspectProductionGate(x).blockers.includes('VERIFIED_GITHUB_RUN_BACKEND'))});
test('old production manifest blocks',()=>{const x=valid();x.manifest.businessVersion='SH-01.30.52 v';assert.ok(inspectProductionGate(x).blockers.includes('SH59_PRODUCTION_IDENTITY'))});
