// Real readback, not a mock or a new business action. Run only against the locked isolated QA runtime.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {qaProject,qaFunction,readLock,requireFreshTime} from '../scripts/release/locked-release.mjs';
import {assertQaSession,expectAuditRequest,requireAuditEvidenceContext,requireCertificationAuditEvidence,verifyAuditRecord} from './helpers/isolated-qa-acceptance.mjs';
const root='/tmp/freight-ci-qa';
const evidenceDir='reports/isolated-rc';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const lock=readLock();
const proof=await read(process.env.QA_BROWSER_BACKEND_PROOF_FILE);
assert.equal(process.env.GITHUB_REPOSITORY,'hakaru4i-afk/freight-quotes-web');
assert.equal(process.env.GITHUB_REF,'refs/heads/main');
assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
assert.equal(process.env.GITHUB_WORKFLOW_REF,'hakaru4i-afk/freight-quotes-web/.github/workflows/isolated-qa-oidc-browser.yml@refs/heads/main');
assert.equal(proof.function,qaFunction);
assert.equal(proof.frontendSha,lock.frontendSha);assert.equal(proof.backendSha,lock.backendSha);
const run={runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,runtime:proof};
const startedAt=new Date().toISOString();
const sessions=await read(root+'/sessions.json'),actors=await read(root+'/actors.json');
const auth=await read('reports/ci-qa-auth.json');
requireAuditEvidenceContext(auth,run);
assert.equal(auth.result,'PASS','QA_AUTH_RECEIPT_REQUIRED');
assert.equal(auth.environment,'isolated-qa');
requireFreshTime(auth.startedAt,Date.parse(proof.observedAt),Date.parse(startedAt));
requireFreshTime(auth.completedAt,Date.parse(auth.startedAt),Date.parse(startedAt));
const business=await read(evidenceDir+'/business-api-real.json');
const certification=requireCertificationAuditEvidence(business,run);
requireFreshTime(business.startedAt,Date.parse(auth.completedAt),Date.parse(startedAt));
requireFreshTime(business.completedAt,Date.parse(business.startedAt),Date.parse(startedAt));
const names=['owner','carrierA','carrierB','ved','logistic','supplier','supplierB','designer','content','purchasing','certification'];
const base='https://'+qaProject+'.supabase.co/functions/v1/'+qaFunction;
const uuid=/^[a-f0-9-]{36}$/i;
const required=new Map();
const expect=(id,expected)=>expectAuditRequest(required,id,expected);
async function call(actor,path,body){
 const url=new URL(base+path);url.searchParams.set('forceFunctionRegion','eu-central-1');
 const res=await fetch(url,{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io',...(actor?{Authorization:'Bearer '+sessions[actor]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});
 return {status:res.status,id:res.headers.get('x-freight-request-id'),data:await res.json()};
}
for(const name of names){
 assert.equal(actors[name]?.login,'rc20261110-'+name.toLowerCase());assert.match(sessions[name]||'',/^[a-f0-9]{64}$/);
 const logins=auth.checks.filter(c=>c.actor===name);
 assert.equal(logins.length,1,'QA_AUTH_ACTOR_RECEIPT_NOT_UNIQUE:'+name);
 const [row]=logins;
 assert.equal(row.result,'PASS','QA_AUTH_ACTOR_RECEIPT_FAILED:'+name);
 expect(row.loginRequestId,{label:'login:'+name,actor:name,path:'/api/auth',status:200,kind:'login'});
 const role=name==='certification'?null:actors[name].role;
 assertQaSession(await call(name,'/api/session'),role,'QA_AUDIT_SESSION_STATE:'+name);
 if(name==='certification')continue;
 if(name!=='owner'){
  const res=await call(name,'/api/site-monitor');
  assert.equal(res.status,403,'NON_OWNER_AUDIT_ACCESS');
  expect(res.id,{label:'denial:'+name,actor:name,path:'/api/site-monitor',status:403,kind:'denied'});
 }
}
for(const [sessionState,id] of [['authenticated',certification.before],['revoked',certification.after]]){
 expect(id,{label:'denial:certification:'+sessionState,actor:'certification',sessionState,path:'/api/site-monitor',
  status:403,kind:'denied',reasonCode:'ACCESS_DENIED',action:'get',phase:'access_denied'});
}
const direct=await call('owner','/api/owner-register-execution',{action:'qa_invalid_audit_action'});
assert.equal(direct.status,400);
expect(direct.id,{label:'direct-handler',actor:'owner',path:'/api/owner-register-execution',status:400,serverCode:'INVALID_ACTION'});
const integration=await call('owner','/api/route-distance',{action:'geocode_points',addresses:[]});
// Valid JSON with an invalid number of points is a semantic validation failure (422), not malformed JSON (400).
assert.equal(integration.status,422,'ROUTE_DISTANCE_VALIDATION_STATUS');
assert.equal(typeof integration.data.error,'string','ROUTE_DISTANCE_VALIDATION_BODY');
expect(integration.id,{label:'integration-validation',actor:'owner',path:'/api/route-distance',status:422,kind:'validation',reasonCode:'VALIDATION_FAILED'});
const files=(await readdir(evidenceDir)).filter(n=>/^browser-results-.*\.json$/.test(n));
const calls=[...business.calls];
for(const file of files){
 const report=await read(evidenceDir+'/'+file);
 requireAuditEvidenceContext({...report,runtime:{frontendSha:report.frontendSha,backendSha:report.backendSourceCommit,
  function:report.backendFunction,version:report.backendVersion,bundle:report.backendBundle}},run);
 requireFreshTime(report.startedAt,Date.parse(auth.completedAt),Date.parse(startedAt));
 requireFreshTime(report.completedAt,Date.parse(report.startedAt),Date.parse(startedAt));
 calls.push(...report.calls);
}
const mutation=c=>['POST','PATCH','PUT','DELETE'].includes(c.method)&&c.status>=200&&c.status<300&&uuid.test(c.requestId||'');
for(const [label,path,actor] of [['request','/api/requests','owner'],['offer','/api/quote','carrierA'],['tracking','/api/task2','carrierA'],['documents','/api/documents','owner'],['chat','/api/chats','ved']]){
 const c=calls.find(c=>c.path===path&&c.actor===actor&&mutation(c));
 if(!c)throw Error('AUDIT_BUSINESS_PROBE_MISSING:'+label);
 expect(c.requestId,{label,actor,path,status:c.status,kind:'action'});
}
for(const [label,path] of [['document-download','/api/documents/file'],['task2-download','/api/task2']]){
 const c=calls.find(c=>c.path===path&&c.download===true&&c.method==='GET'&&c.status===200&&uuid.test(c.requestId||''));
 if(!c)throw Error('AUDIT_DOWNLOAD_PROBE_MISSING:'+label);
 expect(c.requestId,{label,actor:c.actor,path,status:200,action:'download'});
}
const evidence=[],seen=new Set();let cursor='';
for(let page=0;page<100&&required.size;page++){
 const q=new URLSearchParams({since:auth.startedAt,until:new Date().toISOString(),...(cursor?{cursor}:{})});
 const res=await call('owner','/api/site-monitor?'+q);
 assert.equal(res.status,200,'OWNER_AUDIT_READ');
 for(const row of res.data.items||[]){
  assert.ok(!seen.has(row.request_id),'AUDIT_SERVER_RECORD_REUSED:'+row.request_id);
  const e=required.get(row.request_id);if(!e)continue;
  evidence.push(verifyAuditRecord(row,e,actors));
  seen.add(row.request_id);
  required.delete(row.request_id);
 }
 if(!res.data.more)break;
 assert.ok(res.data.cursor&&res.data.cursor!==cursor,'AUDIT_CURSOR_STALLED');cursor=res.data.cursor;
}
await mkdir(evidenceDir,{recursive:true});
await writeFile(evidenceDir+'/site-audit-real.json',JSON.stringify({result:required.size?'FAIL':'PASS',...lock,...run,
 startedAt,completedAt:new Date().toISOString(),evidence,missing:[...required.values()].map(e=>e.label)},null,2)+'\n');
if(required.size)throw Error('AUDIT_READBACK_MISSING:'+ [...required.values()].map(e=>e.label).join(','));
console.log('SITE_AUDIT_REAL_PASS',evidence.length);
