import assert from 'node:assert/strict';
import {recoverVerifiedCarrierB} from '../scripts/qa20-sl-recovery-guard.mjs';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {carrier124, carrier124Base, isolatedApiUrl, assertCandidateCheckout} from './carrier124-isolated-target.mjs';

import {qaDocumentFetch,withQaUploadId} from './helpers/qa-document-transport.mjs';

export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const deadlineMinsk = time => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Minsk', dateStyle:'short', timeStyle:'short'}).format(time).replace(' ', 'T');

export async function createRemainingClient(sessions, log) {
  const manifest=assertCandidateCheckout();
  assert.equal(manifest.sh59IsolatedQa?.projectRef,'ibclzdkxiozbzmniiygv');
  assert.equal(manifest.sh59IsolatedQa?.schema,'freight_qa_carrier124nov18');
  assert.equal(manifest.sh59IsolatedQa?.function,'freight-api-qa-carrier124nov18');
  assert.equal(manifest.sh59IsolatedQa?.version,20);
  const health = await fetch(carrier124Base + '/health', {redirect:'error', signal:AbortSignal.timeout(15000)});
  assert.equal(health.status, 200);
  const identity = await health.json();
  assert.equal(identity.qaRun, carrier124.run);
  assert.equal(identity.projectRef, carrier124.project);
  assert.equal(identity.environment, 'staging');
  assert.equal(identity.edgeVersion,20);
  return async function call(actor, path, query = {}, data, expected = 200) {
    const url = isolatedApiUrl(path);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key,value);
    if (actor) assert.match(sessions[actor] || '', /^[a-f0-9]{64}$/, 'Missing fixture session: ' + actor);
    const multipart = data instanceof FormData;
    withQaUploadId(path,data);
    const r = await qaDocumentFetch(url, {
      redirect:'error', method:data===undefined?'GET':'POST',
      headers:{Origin:'https://hakaru4i-afk.github.io', ...(actor?{Authorization:'Bearer '+sessions[actor]}:{}),
        ...(data!==undefined&&!multipart?{'Content-Type':'application/json'}:{})},
      body:data===undefined?undefined:multipart?data:JSON.stringify(data),
    },{timeout:30000,onTransportRetry:()=>log.push({actor,path,method:'POST',retry:'document_upload_transport'})});
    const requestId = r.headers.get('x-freight-request-id');
    log.push({actor:actor||'anonymous',path,method:data===undefined?'GET':'POST',status:r.status,requestId});
    const allowed = Array.isArray(expected)?expected:[expected];
    assert.ok(allowed.includes(r.status), actor+' '+path+' HTTP '+r.status+' expected '+allowed.join('/')+' request '+requestId);
    const bytes = Buffer.from(await r.arrayBuffer());
    return {status:r.status, requestId, bytes, json:r.headers.get('content-type')?.includes('json')?JSON.parse(bytes):null};
  };
}

export async function publishFixture(call,order, {deadline=deadlineMinsk(Date.now()+86400000), geography={}, attach=true,
  summary='Synthetic QA '+order, bitrixTask='910083,910084', filename='qa-control.txt'}={}) {
  assert.match(order,/^QA-(?:N26-[A-Z0-9-]+|MAP50-EXACT-[0-9]+-[0-9]+)$/);
  const logistics={sender_contact:'QA contact '+order,origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:'QA cargo '+order,
    weight:'1250',volume:'12.5',ready_date:'2099-12-01',incoterm:'EXW',incoterm_place:'QA Brest gate '+order,dangerous_goods:'no',...geography};
  const bytes=Buffer.from('Synthetic control file '+order+'\n');
  if(attach){
    const form=new FormData();
    form.set('order',order);
    form.append('files',new Blob([bytes],{type:'text/plain'}),filename);
    await call('owner','/api/documents',{},form);
  }
  // Award and route control fixtures do not exercise deadline penalties.
  const control=/^QA-(?:N26-OIDC|MAP50-EXACT)-[0-9]+-[0-9]+$/.test(order);
  if(control)deadline='2099-12-15T12:00';
  const receipt=await call('owner','/api/requests',{}, {order,deadline,summary,bitrixTask,logistics});
  return {order,logistics,deadline,published:receipt.json,sha256:sha256(bytes)};
}

export async function awardFixture(call,order,mode='Авто'){
  const id=randomUUID();
  await call('carrierA','/api/quote',{}, {order,carrier:'Synthetic carrier A',contact:'QA contact',consent:true,variants:[
    {mode,currency:'USD',amount:1400,pickup:'2099-12-05',days:21,insurance:'Включено',includes:'QA transport',extras:'No extras',
      validUntil:'2099-12-20',incotermPlace:'QA Brest gate',dangerousGoods:'no',requestId:id}]});
  let bid=(await call('owner','/api/data')).json.bids.find(x=>x.request_id===id);
  assert.ok(bid,'Synthetic offer must persist');
  await call('owner','/api/review',{}, {id:bid.id,decision:'accepted'});
  bid=(await call('owner','/api/data')).json.bids.find(x=>x.id===bid.id);
  const notice=(await call('carrierA','/api/carrier')).json.notifications.find(x=>x.order_code===order);
  await call('owner','/api/offer-selection',{}, {id:notice.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid});
  await call('carrierA','/api/task2',{}, {action:'take',order});
  await call('carrierA','/api/task2',{}, {action:'actual_departure',order,date:new Date(Date.now()-86400000).toISOString()});
  return {bidId:bid.id,noticeId:notice.id};
}

export async function loadRemainingRun() {
  assert.equal(process.env.QA_CARRIER124_CANDIDATE,'true');
  const evidenceDir=process.env.QA_BROWSER_EVIDENCE_DIR;
  const sessionFile=process.env.QA_SESSIONS_FILE;
  assert.ok(evidenceDir&&sessionFile,'Dedicated QA session file and evidence directory required');
  await mkdir(evidenceDir,{recursive:true});
  const sessions=JSON.parse(await readFile(sessionFile,'utf8'));
  return {sessions,evidenceDir,read:name=>readFile(join(evidenceDir,name),'utf8').then(JSON.parse),
    save:(name,data)=>writeFile(join(evidenceDir,name),JSON.stringify(data,null,2)+'\n',{mode:0o600})};
}

const serviceLogin='carrier124nov18-carrierb';
const serviceQuery={login:serviceLogin};
const serviceSupportOrder='SL-SUPPORT-'+serviceLogin.toUpperCase();
const restorationFiles=['n26-guarantee.txt','n26-result.txt'];

async function serviceEvidence(api,{allowUpload=false}={}){
  async function find(){
    const {json}=await api('owner','/api/documents',{order:serviceSupportOrder});
    const verified=[];
    for(const name of restorationFiles){
      const expected=sha256(Buffer.from('Synthetic SL restoration proof '+name));
      let matching;
      for(const file of json.files.filter(row=>row.name===name)){
        const response=await api('owner','/api/documents/file',{id:file.id});
        if(sha256(response.bytes)===expected){matching=file.id;break;}
      }
      if(!matching)return null;
      verified.push(matching);
    }
    return {guaranteeId:verified[0],resultId:verified[1]};
  }
  const existing=await find();
  if(existing)return existing;
  assert.ok(allowUpload,'No verified synthetic Service Level restoration files found');
  const form=new FormData();
  form.set('order',serviceSupportOrder);
  for(const name of restorationFiles)form.append('files',new Blob(['Synthetic SL restoration proof '+name]),name);
  await api('owner','/api/documents',{},form);
  const evidence=await find();
  assert.ok(evidence,'Uploaded restoration evidence was not readable with the known digest');
  return evidence;
}

async function restoreServiceScore(api,score,files,reason){
  const action=body=>api('owner','/api/service-level',{}, {login:serviceLogin,...body});
  let current=(await api('owner','/api/service-level',serviceQuery)).json;
  if(current.policy.blocked){
    await action({action:'unlock',reason,...files});
    current=(await api('owner','/api/service-level',serviceQuery)).json;
    assert.equal(current.policy.blocked,false);
  }
  if(current.policy.score!==score){
    await action({action:'set_score',value:score,reason,expectedRevision:current.revision,requestId:randomUUID()});
  }
  const restored=(await api('owner','/api/service-level',serviceQuery)).json.policy;
  assert.equal(restored.score,score);
  assert.equal(restored.blocked,false);
  return {score:restored.score,blocked:restored.blocked};
}

export async function recoverInterruptedCarrierBoundary(api){
  const carrierB=await recoverVerifiedCarrierB(api,()=>serviceEvidence(api));

  const login='carrier124nov18-carriera';
  const query={login};
  const other=(await api('owner','/api/service-level',query)).json;
  assert.equal(other.policy.blocked,false,'Unexpected Carrier A block');
  let carrierA={recoveryRequired:false,score:other.policy.score};
  if(other.policy.score<79){
    const abandonedOrder='QA-CI-FE0D4777-LATE-626BDF21';
    const matches=other.events.filter(row=>row.order_code===abandonedOrder&&row.kind==='no_response'&&!row.corrected);
    assert.equal(other.policy.score,76,'Unexpected Carrier A fixture score');
    assert.equal(matches.length,1);
    assert.equal(matches[0].actor,'system');
    assert.equal(matches[0].source_kind,'request');
    assert.equal(Number(matches[0].requested_delta),-3);
    assert.equal(Number(matches[0].score_before),79);
    await api('owner','/api/service-level',{}, {
      login,action:'void_event',eventId:matches[0].id,expectedRevision:other.revision,requestId:randomUUID(),
      reason:'Close accounting for the abandoned isolated QA late-bid fixture '+abandonedOrder
    });
    const restored=(await api('owner','/api/service-level',query)).json;
    assert.equal(restored.policy.score,79);
    assert.equal(restored.policy.blocked,false);
    assert.ok(restored.events.some(row=>row.id===matches[0].id&&row.corrected));
    carrierA={recoveryRequired:true,score:restored.policy.score};
  }
  return {carrierA,carrierB};
}

export async function verifyServiceBoundaries(api,onBoundary=async()=>{},boundaries=[76,75,51,50]){
  const order='QA-N26-SEC-B1';
  const original=(await api('owner','/api/service-level',serviceQuery)).json;
  assert.equal(original.policy.blocked,false);
  // Keep the recovery path available before any test can lock this fixture.
  const files=await serviceEvidence(api,{allowUpload:true});
  const scores=[];
  async function setScore(value){
    const current=(await api('owner','/api/service-level',serviceQuery)).json;
    return api('owner','/api/service-level',{}, {login:serviceLogin,action:'set_score',value,
      reason:'Controlled synthetic QA score for the acceptance boundary',
      expectedRevision:current.revision,requestId:randomUUID()});
  }
  try{
    for(const value of boundaries){
      await setScore(value);
      const r=(await api('carrierB','/api/session')).json.carrierPolicy;
      assert.deepEqual([r.score,r.blocked,r.tenderEligible],[value,value<=50,value>=76]);
      await api('carrierB','/api/requests',{order},undefined,value<=50?403:200);
      await api('carrierB','/api/tenders',{},undefined,value<76?403:200);
      await onBoundary(value,r);
      scores.push({value,mode:r.mode});
    }
  }finally{
    await restoreServiceScore(api,original.policy.score,files,'Restore simulated Carrier B after acceptance test');
  }
  return scores;
}
