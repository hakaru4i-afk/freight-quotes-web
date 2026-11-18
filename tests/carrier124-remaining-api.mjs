import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {carrier124, carrier124Base, isolatedApiUrl, assertCandidateCheckout} from './carrier124-isolated-target.mjs';

export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const deadlineMinsk = time => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Minsk', dateStyle:'short', timeStyle:'short'}).format(time).replace(' ', 'T');

export async function createRemainingClient(sessions, log) {
  assertCandidateCheckout();
  const health = await fetch(carrier124Base + '/health', {redirect:'error', signal:AbortSignal.timeout(15000)});
  assert.equal(health.status, 200);
  const identity = await health.json();
  assert.equal(identity.qaRun, carrier124.run);
  assert.equal(identity.projectRef, carrier124.project);
  assert.equal(identity.environment, 'staging');
  return async function call(actor, path, query = {}, data, expected = 200) {
    const url = isolatedApiUrl(path);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key,value);
    if (actor) assert.match(sessions[actor] || '', /^[a-f0-9]{64}$/, 'Missing fixture session: ' + actor);
    const multipart = data instanceof FormData;
    const r = await fetch(url, {
      redirect:'error', method:data===undefined?'GET':'POST',
      headers:{Origin:'https://hakaru4i-afk.github.io', ...(actor?{Authorization:'Bearer '+sessions[actor]}:{}),
        ...(data!==undefined&&!multipart?{'Content-Type':'application/json'}:{})},
      body:data===undefined?undefined:multipart?data:JSON.stringify(data),
      signal:AbortSignal.timeout(30000)
    });
    const requestId = r.headers.get('x-freight-request-id');
    log.push({actor:actor||'anonymous',path,method:data===undefined?'GET':'POST',status:r.status,requestId});
    const allowed = Array.isArray(expected)?expected:[expected];
    assert.ok(allowed.includes(r.status), actor+' '+path+' HTTP '+r.status+' expected '+allowed.join('/')+' request '+requestId);
    const bytes = Buffer.from(await r.arrayBuffer());
    return {status:r.status, requestId, bytes, json:r.headers.get('content-type')?.includes('json')?JSON.parse(bytes):null};
  };
}

export async function publishFixture(call,order, {deadline=deadlineMinsk(Date.now()+86400000), geography={}, attach=true}={}) {
  assert.match(order,/^QA-N26-[A-Z0-9-]+$/);
  const logistics={sender_contact:'QA contact '+order,origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:'QA cargo '+order,
    weight:'1250',volume:'12.5',ready_date:'2099-12-01',incoterm:'EXW',incoterm_place:'QA Brest gate '+order,dangerous_goods:'no',...geography};
  const bytes=Buffer.from('Synthetic control file '+order+'\n');
  if(attach){
    const form=new FormData();
    form.set('order',order);
    form.append('files',new Blob([bytes]),'qa-control.txt');
    await call('owner','/api/documents',{},form);
  }
  const receipt=await call('owner','/api/requests',{}, {order,deadline,summary:'Synthetic QA '+order,bitrixTask:'910083,910084',logistics});
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

export async function verifyServiceBoundaries(api,onBoundary=async()=>{},boundaries=[76,75,51,50]) {
  const login='carrier124nov18-carrierb';
  const order='QA-N26-SEC-B1';
  const query={login};
  const original=(await api('owner','/api/service-level',query)).json;
  assert.equal(original.policy.blocked,false);
  const action=(body,status=200)=>api('owner','/api/service-level',{}, {login,...body},status);
  const scores=[];
  async function setScore(value){
    const current=(await api('owner','/api/service-level',query)).json;
    return action({action:'set_score',value,reason:'Controlled synthetic QA score for the acceptance boundary',expectedRevision:current.revision,requestId:randomUUID()});
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
    const current=(await api('owner','/api/service-level',query)).json;
    if(current.policy.blocked){
      const files=new FormData();
      const support='SL-SUPPORT-'+login.toUpperCase();
      files.set('order',support);
      for(const name of ['n26-guarantee.txt','n26-result.txt'])files.append('files',new Blob(['Synthetic SL restoration proof '+name]),name);
      await api('owner','/api/documents',{},files);
      const docs=(await api('owner','/api/documents',{order:support})).json.files;
      await action({action:'unlock',reason:'Restore simulated Carrier B after acceptance test',guaranteeId:docs.find(d=>d.name==='n26-guarantee.txt').id,resultId:docs.find(d=>d.name==='n26-result.txt').id});
    }
    await setScore(original.policy.score);
    const restored=(await api('owner','/api/service-level',query)).json.policy;
    assert.equal(restored.score,original.policy.score);
    assert.equal(restored.blocked,false);
  }
  return scores;
}
