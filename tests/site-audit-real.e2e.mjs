// Real readback, not a mock or a new business action. Run only against the locked isolated QA runtime.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {qaProject,qaFunction,readLock} from '../scripts/release/locked-release.mjs';
const root='/tmp/freight-ci-qa';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const lock=readLock();
const proof=await read(process.env.QA_BROWSER_BACKEND_PROOF_FILE);
assert.equal(process.env.GITHUB_REPOSITORY,'hakaru4i-afk/freight-quotes-web');
assert.equal(process.env.GITHUB_REF,'refs/heads/main');
assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
assert.equal(process.env.GITHUB_WORKFLOW_REF,'hakaru4i-afk/freight-quotes-web/.github/workflows/isolated-qa-oidc-browser.yml@refs/heads/main');
assert.equal(proof.function,qaFunction);
assert.equal(proof.frontendSha,lock.frontendSha);assert.equal(proof.backendSha,lock.backendSha);
const sessions=await read(root+'/sessions.json'),actors=await read(root+'/actors.json');
const auth=await read('reports/ci-qa-auth.json');
const names=['owner','carrierA','carrierB','ved','logistic','supplier','supplierB','designer','content','purchasing','certification'];
const base='https://'+qaProject+'.supabase.co/functions/v1/'+qaFunction;
const uuid=/^[a-f0-9-]{36}$/i;
const required=new Map();
function expect(id,expected){
 if(!uuid.test(id||''))throw Error('AUDIT_REQUEST_ID_MISSING:'+expected.label);
 required.set(id,expected);
}
async function call(actor,path,body){
 const url=new URL(base+path);url.searchParams.set('forceFunctionRegion','eu-central-1');
 const res=await fetch(url,{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io',...(actor?{Authorization:'Bearer '+sessions[actor]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});
 return {status:res.status,id:res.headers.get('x-freight-request-id'),data:await res.json()};
}
for(const name of names){
 assert.equal(actors[name]?.login,'rc20261110-'+name.toLowerCase());assert.match(sessions[name]||'',/^[a-f0-9]{64}$/);
 const row=auth.checks.find(c=>c.actor===name&&c.result==='PASS');
 expect(row?.loginRequestId,{label:'login:'+name,actor:name,path:'/api/auth',status:200,kind:'login'});
 if(name!=='owner'){
  const res=await call(name,'/api/site-monitor');
  assert.equal(res.status,403,'NON_OWNER_AUDIT_ACCESS');
  expect(res.id,{label:'denial:'+name,actor:name,path:'/api/site-monitor',status:403,kind:'denied'});
 }
}
const direct=await call('owner','/api/owner-register-execution',{action:'qa_invalid_audit_action'});
assert.equal(direct.status,400);
expect(direct.id,{label:'direct-handler',actor:'owner',path:'/api/owner-register-execution',status:400,serverCode:'INVALID_ACTION'});
const integration=await call('owner','/api/route-distance',{action:'geocode_points',addresses:[]});
assert.equal(integration.status,400);
expect(integration.id,{label:'integration-validation',actor:'owner',path:'/api/route-distance',status:400});
const files=(await readdir('reports/isolated-rc')).filter(n=>/^browser-results-.*\.json$/.test(n)||n==='business-api-real.json');
let calls=[];
for(const file of files){const report=await read('reports/isolated-rc/'+file);calls.push(...(report.calls||[]));}
const mutation=c=>['POST','PATCH','PUT','DELETE'].includes(c.method)&&c.status>=200&&c.status<300&&uuid.test(c.requestId||'');
for(const [label,path,actor] of [['request','/api/requests','owner'],['offer','/api/quote','carrierA'],['tracking','/api/task2','carrierA'],['documents','/api/documents','owner'],['chat','/api/chats','ved']]){
 const c=calls.find(c=>c.path===path&&c.actor===actor&&mutation(c));
 if(!c)throw Error('AUDIT_BUSINESS_PROBE_MISSING:'+label);
 expect(c.requestId,{label,actor,path,status:c.status,kind:'action'});
}
const download=calls.find(c=>c.path==='/api/documents/file'&&c.method==='GET'&&c.status===200&&uuid.test(c.requestId||''));
if(download)expect(download.requestId,{label:'document-download',actor:download.actor,path:download.path,status:200,action:'download'});
// Existing suites may use a direct fetch for downloads rather than the shared recorder;
// never manufacture a receipt from that untracked call.
const evidence=[];let cursor='';
for(let page=0;page<100&&required.size;page++){
 const q=new URLSearchParams({since:auth.startedAt,until:new Date().toISOString(),...(cursor?{cursor}:{})});
 const res=await call('owner','/api/site-monitor?'+q);
 assert.equal(res.status,200,'OWNER_AUDIT_READ');
 for(const row of res.data.items||[]){
  const e=required.get(row.request_id);if(!e)continue;
  const d=typeof row.detail==='string'?JSON.parse(row.detail):row.detail;
  assert.equal(row.actor,actors[e.actor].login,e.label+': actor');
  assert.equal(row.role,actors[e.actor].role,e.label+': role');
  assert.equal(row.source,'server',e.label+': source');
  assert.equal(row.path,e.path,e.label+': path');assert.equal(Number(row.status),e.status,e.label+': status');
  assert.match(d.reasonCode||'',/^[A-Z0-9_]+$/,e.label+': reason');
  if(e.kind)assert.equal(row.kind,e.kind,e.label+': kind');
  if(e.action)assert.equal(row.action,e.action,e.label+': action');
  if(e.serverCode)assert.equal(d.serverCode,e.serverCode,e.label+': server code');
  evidence.push({label:e.label,role:row.role,path:row.path,status:Number(row.status),kind:row.kind,reasonCode:d.reasonCode,requestId:row.request_id});
  required.delete(row.request_id);
 }
 if(!res.data.more)break;
 assert.ok(res.data.cursor&&res.data.cursor!==cursor,'AUDIT_CURSOR_STALLED');cursor=res.data.cursor;
}
await mkdir('reports/isolated-rc',{recursive:true});
await writeFile('reports/isolated-rc/site-audit-real.json',JSON.stringify({result:required.size?'FAIL':'PASS',frontendSha:lock.frontendSha,backendSha:lock.backendSha,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,evidence,missing:[...required.values()].map(e=>e.label)},null,2)+'\n');
if(required.size)throw Error('AUDIT_READBACK_MISSING:'+ [...required.values()].map(e=>e.label).join(','));
console.log('SITE_AUDIT_REAL_PASS',evidence.length);
