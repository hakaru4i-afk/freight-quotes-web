// Actual isolated QA HTTP requests. No fixture can target staging or production.
// API-only results remain API-only; browser acceptance is recorded separately.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {join} from 'node:path';
import {carrier124,carrier124Base,assertCandidateCheckout} from './carrier124-isolated-target.mjs';
const exactCandidate=process.env.QA_CARRIER124_CANDIDATE==='true';
const base=exactCandidate?carrier124Base:'https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const root=exactCandidate?process.env.QA_CARRIER124_PRIVATE_DIR:'/tmp/freight-ci-qa';
const evidenceDir=exactCandidate?process.env.QA_BROWSER_EVIDENCE_DIR:'reports/isolated-rc';
if(exactCandidate){
 assert.ok(root&&evidenceDir,'Dedicated private state and evidence directories required');
 assertCandidateCheckout();
 const health=await fetch(base+'/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.equal(health.status,200);
 const data=await health.json();
 assert.equal(data.qaRun,carrier124.run);
 assert.equal(data.projectRef,carrier124.project);
 assert.equal(data.environment,'staging');
}else{
 assert.equal(process.env.GITHUB_REPOSITORY,'hakaru4i-afk/freight-quotes-web');
 assert.equal(process.env.GITHUB_REF,'refs/heads/main');
 assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);
}
const sessions=JSON.parse(await readFile(join(root,'sessions.json'),'utf8'));
const actors=JSON.parse(await readFile(join(root,'actors.json'),'utf8'));
const loginPrefix=exactCandidate?carrier124.run:'rc20261110';
const expectedActors=['owner','carrierA','carrierB','ved','logistic','supplier','supplierB','designer','content','purchasing','certification'];
for(const id of expectedActors){
 assert.equal(actors[id]?.login,loginPrefix+'-'+id.toLowerCase());
 assert.match(sessions[id]||'',/^[a-f0-9]{64}$/,'Missing QA session for '+id);
}
assert.equal(new Set(expectedActors.map(id=>sessions[id])).size,expectedActors.length);
const runId=exactCandidate?randomUUID().slice(0,8).toUpperCase():process.env.GITHUB_RUN_ID;
const report={environment:'isolated-qa',mode:'AUTHENTICATED_QA_API',runId,frontendSha:exactCandidate?carrier124.frontendSource:process.env.GITHUB_SHA,
 ...(exactCandidate?{target:carrier124}:{}),productionDataUsed:false,checks:[],calls:[]};
const selected=exactCandidate?new Set((process.env.QA_CARRIER124_CASES||'').split(',').filter(Boolean)):new Set();
async function call(actor,path,body,method){
 const url=new URL(base+path);url.searchParams.set('forceFunctionRegion','eu-central-1');const multipart=body instanceof FormData;
 const r=await fetch(url,{...(exactCandidate?{redirect:'error'}:{}),method:method||(body?'POST':'GET'),headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor],...(multipart?{}:{'Content-Type':'application/json'})},body:multipart?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
 report.calls.push({actor,path:path.split('?')[0],method:method||(body?'POST':'GET'),status:r.status,requestId:r.headers.get('x-freight-request-id')});return {status:r.status,data:await r.json()};
}
const ok=r=>{assert.equal(r.status,200);return r.data;};
async function check(id,run){if(selected.size&&!selected.has(id))return;const entry={id,status:'FAIL',mode:'AUTHENTICATED_QA_API'};report.checks.push(entry);try{entry.evidence=await run();entry.status='PASS';console.log('QA_BUSINESS_API_PASS',id);}catch(e){entry.errorType=e.code||e.name;const line=String(e.stack).match(/task12-business-api\.e2e\.mjs:(\d+:\d+)/);if(line)entry.assertionLine=line[1];for(const key of ['actual','expected'])if(['number','boolean'].includes(typeof e[key]))entry[key]=e[key];console.log('QA_BUSINESS_API_FAIL',id,JSON.stringify({errorType:entry.errorType,assertionLine:entry.assertionLine,actual:entry.actual,expected:entry.expected}));process.exitCode=1;}}
const makeOrder=kind=>'QA-CI-'+runId+'-'+kind+'-'+randomUUID().slice(0,8).toUpperCase();
const logistics={sender_contact:'Synthetic QA sender',origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:'Synthetic QA pallets',volume:'12.5',weight:'1250',ready_date:'2099-12-01',incoterm:'EXW',incoterm_place:'Brest warehouse',dangerous_goods:'no'};
async function upload(order,name,bytes){const f=new FormData();f.set('order',order);f.append('files',new Blob([bytes]),name);return ok(await call('owner','/api/documents',f));}
async function create(order,sourceLogistics=logistics,deadline='2099-12-15T12:00'){await upload(order,'qa-required.txt','Synthetic QA attachment');const data=ok(await call('owner','/api/requests',{order,summary:'Synthetic API business acceptance',deadline,bitrixTask:'910001,910002',logistics:sourceLogistics}));assert.equal(data.recipients,2);return data;}
const variant=(amount=1500)=>({mode:'Авто',currency:'USD',amount,pickup:'2099-12-05',days:21,insurance:'Включено',includes:'Transport and documents',extras:'No extras',validUntil:'2099-12-20',incotermPlace:'Brest warehouse',dangerousGoods:'no',note:'Synthetic isolated QA offer',requestId:randomUUID()});
try{
 await check('required_fields_server_negatives',async()=>{const order=makeOrder('REQUIRED');await upload(order,'qa-validation.txt','Synthetic negative validation');const fields=['sender_contact','origin','destination','cargo','volume','ready_date','incoterm','dangerous_goods'];for(const field of fields){const r=await call('owner','/api/requests',{order,deadline:'2099-12-15T12:00',logistics:{...logistics,[field]:field==='dangerous_goods'?'unknown':''}});assert.equal(r.status,400);assert.ok(r.data.fields.includes(field));}return{rejectedFields:fields,serverRejectsMissingFields:true};});
 await check('published_fields_files_and_incoterms_survive_owner_edit',async()=>{
  const order=makeOrder('DOCUMENTS');await create(order);const bytesA=Buffer.from('Synthetic multi-file A'),bytesB=Buffer.from('Synthetic multi-file B'),form=new FormData();form.set('order',order);form.append('files',new Blob([bytesA]),'qa-multi-a.txt');form.append('files',new Blob([bytesB]),'qa-multi-b.txt');ok(await call('owner','/api/documents',form));const docs=ok(await call('owner','/api/documents?order='+order));assert.equal(docs.files.length,3);const before=ok(await call('owner','/api/requests?order='+order)).request;assert.match(before.registration_no,/TR-/);assert.deepEqual(before.bitrix_task.split(/[,;\s]+/).filter(Boolean),['910001','910002']);const fields={...logistics,cargo:'Synthetic edited cargo'};delete fields.sender_contact;delete fields.incoterm_place;const body={action:'save_logistics',order,roundId:before.round_id,expectedRevision:Number(before.logistics_revision),logistics:fields};for(const actor of['carrierA','carrierB','ved','supplier'])assert.equal((await call(actor,'/api/requests',body)).status,403);ok(await call('owner','/api/requests',body));assert.equal((await call('owner','/api/requests',body)).status,409);for(const actor of['owner','carrierA','carrierB']){const after=ok(await call(actor,'/api/requests?order='+order)).request;assert.equal(after.cargo,fields.cargo);for(const key of['origin','destination','weight','volume','ready_date','sender_contact','incoterm','incoterm_place','round_id','bitrix_task','registration_no'])assert.equal(after[key],before[key]);const access=actor==='owner'?docs.access:ok(await call(actor,'/api/carrier')).notifications.find(x=>x.order_code===order)?.access_token;assert.ok(access);if(actor!=='owner')assert.equal((await call(actor,'/api/documents?order='+order)).status,403);assert.equal(ok(await call(actor,'/api/documents?order='+order+'&access='+encodeURIComponent(access))).files.length,3);}const a=docs.files.find(x=>x.name==='qa-multi-a.txt'),b=docs.files.find(x=>x.name==='qa-multi-b.txt');assert.ok(a&&b);for(const actor of['owner','carrierA','carrierB']){const access=actor==='owner'?docs.access:ok(await call(actor,'/api/carrier')).notifications.find(x=>x.order_code===order)?.access_token;assert.ok(access);const r=await fetch(base+'/api/documents/file?id='+a.id+'&access='+encodeURIComponent(access)+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]},signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytesA);}assert.equal((await call('carrierA','/api/documents',{action:'remove',order,id:b.id})).status,403);assert.equal(ok(await call('owner','/api/documents',{action:'remove',order,id:b.id})).removed,true);assert.equal(ok(await call('owner','/api/documents',{action:'remove',order,id:b.id})).removed,false);assert.equal(ok(await call('owner','/api/documents?order='+order)).files.length,2);report.editedRequest={order,cargo:fields.cargo};return{order,ownerOnlyEdit:true,staleEditDenied:true,sourceFieldsAndIncotermPlacePreserved:true,bitrixNumbers:2,uploadedTogether:2,downloadedByRoles:3,sha256:createHash('sha256').update(bytesA).digest('hex'),removedOnce:true};
 });
 await check('timely_refusal_requires_reason_and_never_penalizes_service_level',async()=>{
  const order=makeOrder('REFUSAL');await create(order);const before=ok(await call('carrierA','/api/service-level'));assert.equal((await call('carrierA','/api/decline',{order,reason:''})).status,400);assert.equal((await call('owner','/api/decline',{order,reason:'Synthetic timely refusal'})).status,403);ok(await call('carrierA','/api/decline',{order,reason:'Synthetic timely refusal: equipment unavailable'}));let after=ok(await call('carrierA','/api/service-level'));assert.equal(after.policy.score,before.policy.score);assert.equal(after.events.filter(x=>x.order_code===order).length,0);ok(await call('carrierA','/api/decline',{order,action:'resume'}));after=ok(await call('carrierA','/api/service-level'));assert.equal(after.policy.score,before.policy.score);return{order,emptyReasonDenied:true,ownerCannotImpersonateCarrier:true,timelyRefusalNoPenalty:true,resumedBeforeDeadline:true};
 });
 await check('multiple_variants_currency_edit_and_stale_write',async()=>{
  const order=makeOrder('VARIANTS');await create(order);const a=variant(),b=variant(1650);const request={order,carrier:'Synthetic carrier A',contact:'Synthetic QA contact',consent:true,variants:[a,b]};ok(await call('carrierA','/api/quote',request));ok(await call('carrierA','/api/quote',request));let data=ok(await call('owner','/api/data'));const rows=data.bids.filter(x=>x.order_code===order);assert.equal(rows.length,2);const original=rows.find(x=>x.request_id===a.requestId);assert.ok(original);const edit={...original,expected:original,amount:1600,currency:'EUR'};for(const actor of ['carrierA','carrierB','ved'])assert.equal((await call(actor,'/api/bids',edit,'PATCH')).status,403);ok(await call('owner','/api/bids',edit,'PATCH'));const current=ok(await call('owner','/api/data')).bids.find(x=>x.id===original.id);assert.equal(Number(current.amount),1600);assert.equal(current.currency,'EUR');for(const k of ['route','origin','destination','weight','order_code','round_id','bitrix_task'])assert.equal(current[k],original[k]);assert.equal((await call('owner','/api/bids',edit,'PATCH')).status,409);return{order,variants:2,replayDidNotDuplicate:true,currency:'EUR',staleWrite:409,forbiddenRoles:3,sourceFieldsPreserved:true};
 });
 await check('late_preparation_blocks_winner_and_submitted_offer_stays_reviewable',async()=>{
  const order=makeOrder('LATE');
  const deadlineMs=Math.ceil((Date.now()+60000)/60000)*60000;
  const deadline=exactCandidate?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Minsk',dateStyle:'short',timeStyle:'short'}).format(deadlineMs).replace(' ','T'):undefined;
  await create(order,logistics,deadline);const b=variant(1400);ok(await call('carrierB','/api/quote',{order,carrier:'Synthetic timely carrier',contact:'Synthetic QA contact',variants:[b]}));
  if(exactCandidate){
   await delay(Math.max(0,deadlineMs-Date.now()+2000));
  }else{
   const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);assert.equal(identityUrl.protocol,'https:');identityUrl.searchParams.set('audience','freight-isolated-qa-credentials');const identityResponse=await fetch(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(30000)});assert.equal(identityResponse.status,200);const identity=(await identityResponse.json()).value;assert.ok(identity);
   const expire=await fetch('https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-qa-credential-broker',{method:'POST',headers:{Authorization:'Bearer '+identity,'Content-Type':'application/json'},body:JSON.stringify({action:'expire_fixture_deadline',actor:'owner',order}),signal:AbortSignal.timeout(45000)});assert.equal(expire.status,200);assert.equal((await expire.json()).fixtureExpired,true);
  }
  const n=ok(await call('carrierA','/api/carrier')).notifications.find(x=>x.order_code===order);assert.ok(n);const prepare={action:'start',order,notificationId:n.id};ok(await call('carrierA','/api/late-bid-drafts',prepare));ok(await call('carrierA','/api/late-bid-drafts',prepare));const before=ok(await call('carrierA','/api/service-level'));assert.ok(Number.isFinite(Number(before.policy.score)));assert.equal(before.events.filter(e=>e.order_code===order).length,1);
  let bid=ok(await call('owner','/api/data')).bids.find(x=>x.order_code===order&&x.request_id===b.requestId);assert.ok(bid);ok(await call('owner','/api/review',{id:bid.id,decision:'accepted'}));bid=ok(await call('owner','/api/data')).bids.find(x=>x.id===bid.id);const notice=ok(await call('carrierB','/api/carrier')).notifications.find(x=>x.order_code===order);const select={id:notice.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid};const blocked=await call('owner','/api/offer-selection',select);assert.equal(blocked.status,409);assert.match(blocked.data.error,/подготов|поздн/i);
  const a=variant(1700),a2=variant(1800);ok(await call('carrierA','/api/quote',{order,carrier:'Synthetic late carrier',contact:'Synthetic QA contact',variants:[a,a2]}));const late=ok(await call('owner','/api/data')).bids.filter(x=>x.order_code===order&&[a.requestId,a2.requestId].includes(x.request_id));assert.equal(late.length,2);for(const row of late){assert.equal(Number(row.late),1);assert.equal(row.decision,'pending');}for(const [i,row]of late.entries())ok(await call('owner','/api/review',{id:row.id,decision:i?'rejected':'accepted',reason:'Synthetic explicit late-offer review'}));const after=ok(await call('carrierA','/api/service-level'));assert.equal(after.policy.score,before.policy.score,'A late bid must not restore the missed-deadline penalty');const events=after.events.filter(e=>e.order_code===order);assert.equal(events.filter(e=>e.kind==='no_response').length,1,'The missed deadline is penalized once');assert.equal(events.filter(e=>e.kind==='late_response_after_no_response').length,1,'The later submission has one separate informational audit');assert.equal(events.find(e=>e.kind==='late_response_after_no_response').delta,0);assert.equal(events.reduce((sum,e)=>sum+Number(e.delta),0),before.events.filter(e=>e.order_code===order).reduce((sum,e)=>sum+Number(e.delta),0),'The informational audit must not change the penalty');ok(await call('owner','/api/offer-selection',select));return{order,fixtureDeadlineOnly:true,applicationClockUnchanged:true,deadlineMethod:exactCandidate?'elapsed-minsk-deadline':'protected-fixture-broker',activePreparationWinnerStatus:409,lateVariants:2,explicitOwnerDecisions:['accepted','rejected'],winnerSelectedAfterSubmission:true,lateBidDoesNotRestoreScore:true,onePenaltyEvent:true};
 });
 await check('sea_air_multimodal_shipments_retain_actual_tracking_without_guessed_coordinates',async()=>{
  const shipments=[];for(const item of[{tag:'SEA',mode:'Море',origin:'Китай, Нинбо',destination:'Россия, Владивосток',location:'Китай, Нинбо, порт Ningbo Zhoushan Port'},{tag:'AIR',mode:'Авиа',origin:'Китай, Пекин',destination:'Германия, Франкфурт-на-Майне',location:'Германия, Франкфурт-на-Майне, аэропорт Frankfurt Airport'},{tag:'MULTI',mode:'Мультимодальная',origin:'Китай, Нинбо',destination:'Беларусь, Минск',location:'Россия, Забайкальск, станция Забайкальск'}]){
   const order=makeOrder(item.tag),lg={...logistics,origin:item.origin,destination:item.destination};await create(order,lg);const quote={...variant(1500),mode:item.mode};ok(await call('carrierA','/api/quote',{order,carrier:'Synthetic mode carrier',contact:'Synthetic QA contact',variants:[quote]}));let bid=ok(await call('owner','/api/data')).bids.find(x=>x.order_code===order&&x.request_id===quote.requestId);assert.ok(bid);ok(await call('owner','/api/review',{id:bid.id,decision:'accepted'}));bid=ok(await call('owner','/api/data')).bids.find(x=>x.id===bid.id);const notice=ok(await call('carrierA','/api/carrier')).notifications.find(x=>x.order_code===order);ok(await call('owner','/api/offer-selection',{id:notice.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid}));ok(await call('carrierA','/api/task2',{order,action:'take'}));ok(await call('carrierA','/api/task2',{order,action:'actual_departure',date:'2026-11-02T06:00:00+03:00'}));const point={order,action:'save',fields:{location:item.location,location_date:'2026-11-13T06:00:00+03:00',location_comment:'Synthetic mode-specific tracking observation'}};ok(await call('carrierA','/api/task2',point));const d=ok(await call('carrierA','/api/task2?order='+order));ok(await call('carrierA','/api/task2',point));const after=ok(await call('carrierA','/api/task2?order='+order));assert.deepEqual(after.points.map(x=>x.id),d.points.map(x=>x.id));assert.equal(d.shipment.mode,item.mode);assert.equal(d.points.length,1);assert.ok(d.state.actual_departure);assert.equal((await call('carrierB','/api/task2?order='+order)).status,403);assert.equal((await call('supplier','/api/task2?order='+order)).status,403);assert.equal((await call('ved','/api/task2?order='+order)).status,200);shipments.push({order,mode:item.mode,tag:item.tag,pointIds:d.points.map(x=>x.id),geocodeStatus:d.points[0].geocode?.status||'unverified'});
  }report.modeShipments=shipments;return{shipments,unchangedReplay:true,roleDenials:true};
 });
 await check('competitive_tender_step_final_protocol_and_role_guard',async()=>{
  const order=makeOrder('TENDER'),body={action:'create',order,title:'Synthetic QA price tender',criteria:'Lowest eligible total price',mode:'price',currency:'USD',deadline:'2099-12-20T12:00',step:15,ceiling:2000,extension:false,participants:[actors.carrierA.login,actors.carrierB.login],origin:'Brest, Belarus',destination:'Minsk, Belarus',grossWeight:'1250'};assert.equal((await call('carrierA','/api/tenders',body)).status,403);const id=ok(await call('owner','/api/tenders',body)).id;assert.ok(id);const a={action:'offer',id,requestId:randomUUID(),amount:1500,days:21,terms:'Synthetic QA transport'};ok(await call('carrierA','/api/tenders',a));const b={...a,requestId:randomUUID(),amount:1490};assert.equal((await call('carrierB','/api/tenders',b)).status,409);b.amount=1480;ok(await call('carrierB','/api/tenders',b));ok(await call('carrierB','/api/tenders',b));ok(await call('owner','/api/tenders',{action:'close',id,reason:'Synthetic early close after both offers'}));const d=ok(await call('owner','/api/tenders?id='+id)),winner=d.item.participants.find(p=>p.login===actors.carrierB.login);assert.ok(winner);ok(await call('owner','/api/tenders',{action:'finalize',id,winner:winner.id,reason:'Synthetic lowest eligible offer'}));const protocol=ok(await call('owner','/api/tenders?protocol='+id));assert.equal(protocol.final,true);assert.equal(protocol.protocol.tender.winner,winner.id);assert.equal((await call('carrierA','/api/tenders?protocol='+id)).status,403);return{order,id,step:15,acceptedImprovement:20,duplicateOfferProtected:true,final:true,protocol:protocol.protocol.tender.protocol};
 });
 await check('carrier_124_server_stages_first_open_winner_and_actual_departure',async()=>{
  // Real protected QA only. The previous QA44 without this capability must
  // fail here; no fixture, synthetic PASS, or fallback replaces the response.
  for(const actor of Object.keys(sessions)){const profile=ok(await call(actor,'/api/session'));assert.equal(profile.authenticated,true,actor+' session must be valid');assert.equal(profile.role,actors[actor].role,actor+' role must be verified');}
  const preflight=ok(await call('carrierA','/api/carrier'));
  assert.equal(preflight.dashboard?.version,1,'Deploy the reviewed dashboard API to isolated QA before this gate');
  const order=makeOrder('DASHBOARD124');await create(order);
  const keys=['new','viewed','preparing','review','selected','execution','all','requires_response','declined','lost','completed','archive'];
  const read=async actor=>{
   const data=ok(await call(actor,'/api/carrier'));assert.equal(data.dashboard.version,1);
   const own=new Set(data.notifications.map(n=>n.id));
   for(const item of data.dashboard.items)assert.ok(own.has(item.id),'Foreign dashboard notification');
   for(const key of keys)assert.equal(data.dashboard.counts[key],data.dashboard.items.filter(x=>x.stage===key||x.filters.includes(key)).length,key);
   assert.equal(data.dashboard.items.filter(x=>x.order_code===order).length,1,'One current-round dashboard row per order');
   return data;
  };
  const stage=async(actor,expected)=>{const data=await read(actor);assert.equal(data.dashboard.items.find(x=>x.order_code===order).stage,expected);return data;};
  const first=await stage('carrierA','new'),notice=first.notifications.find(n=>n.order_code===order);assert.equal(notice.read_at,null);
  ok(await call('carrierA','/api/carrier',{id:notice.id}));const viewed=await stage('carrierA','viewed'),opened=viewed.notifications.find(n=>n.id===notice.id).read_at;assert.ok(Number.isFinite(Date.parse(opened)));
  ok(await call('carrierA','/api/carrier',{id:notice.id}));assert.equal((await read('carrierA')).notifications.find(n=>n.id===notice.id).read_at,opened,'First read persists across separate authenticated HTTP requests');
  assert.equal((await call('carrierB','/api/carrier',{id:notice.id})).status,404);
  ok(await call('carrierA','/api/request-status',{id:notice.id,status:'accepted'}));await stage('carrierA','preparing');
  const a1=variant(1300),a2=variant(1400),b=variant(1500),quote={order,carrier:'Synthetic dashboard carrier A',contact:'Synthetic QA contact',variants:[a1,a2]};
  ok(await call('carrierA','/api/quote',quote));ok(await call('carrierA','/api/quote',quote));await stage('carrierA','review');
  ok(await call('carrierB','/api/quote',{order,carrier:'Synthetic dashboard carrier B',contact:'Synthetic QA contact',variants:[b]}));await stage('carrierB','review');
  let rows=ok(await call('owner','/api/data')).bids.filter(x=>x.order_code===order);assert.equal(rows.length,3,'Quote replay must not create a duplicate bid');
  for(const row of rows)ok(await call('owner','/api/review',{id:row.id,decision:'accepted'}));
  rows=ok(await call('owner','/api/data')).bids.filter(x=>x.order_code===order);const bid=rows.find(x=>x.request_id===a1.requestId);assert.ok(bid);
  const choose={id:notice.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid};ok(await call('owner','/api/offer-selection',choose));
  const repeated=await call('owner','/api/offer-selection',choose);assert.ok([200,409].includes(repeated.status));
  assert.equal(ok(await call('owner','/api/data')).selections.filter(x=>x.round_id===notice.round_id).length,1,'Winner replay must not create another selection');
  await stage('carrierA','selected');await stage('carrierB','lost');
  ok(await call('carrierA','/api/task2',{order,action:'take'}));await stage('carrierA','selected');
  const actual=new Date(Date.now()-600000).toISOString();ok(await call('carrierA','/api/task2',{order,action:'actual_departure',date:actual}));await stage('carrierA','execution');
  const task=ok(await call('carrierA','/api/task2?order='+order));assert.ok(task.state.actual_departure);await stage('carrierB','lost');
  for(const actor of Object.keys(sessions).filter(x=>!['carrierA','carrierB'].includes(x)))assert.equal((await call(actor,'/api/carrier')).status,403,actor+' cannot read Carrier counters');
  const refusal=makeOrder('DASHBOARD124REFUSAL');await create(refusal);ok(await call('carrierB','/api/decline',{order:refusal,reason:'Synthetic dashboard refusal, not a lost selection'}));
  assert.equal(ok(await call('carrierB','/api/carrier')).dashboard.items.find(x=>x.order_code===refusal).stage,'declined');
  return {order,stages:['new','viewed','preparing','review','selected','execution'],firstOpenPersisted:true,quoteReplayProtected:true,winnerReplayProtected:true,loserNeverInTransit:true,refusalSeparateFromLoss:true,roleDenials:true,serverCountListParity:true,actualDeparture:task.state.actual_departure};
 });
 await check('two_sessions_and_three_wrong_passwords',async()=>{
  const actor='certification',old=sessions[actor],created=[];for(let i=0;i<2;i++){const r=ok(await call(actor,'/api/auth',{action:'login',login:actors[actor].login,password:process.env.QA_CERTIFICATION_PASSWORD}));assert.match(r.sessionToken||'',/^[a-f0-9]{64}$/);created.push(r.sessionToken);}
  sessions[actor]=old;assert.equal((await call(actor,'/api/session')).data.authenticated,false);for(const token of created){sessions[actor]=token;assert.equal((await call(actor,'/api/session')).data.authenticated,true);}let r;for(let i=0;i<3;i++){r=await call(actor,'/api/auth',{action:'login',login:actors[actor].login,password:'Synthetic-deliberately-wrong-password'});assert.equal(r.status,401);}assert.equal(r.data.recoveryRequested,true);for(const token of created){sessions[actor]=token;ok(await call(actor,'/api/auth',{action:'logout'}));}sessions[actor]=old;return{oldSessionRevoked:true,maximumActiveSessions:2,wrongAttempts:3,recoveryRequested:true};
 });
 report.result=report.checks.length===9&&report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';if(report.result!=='PASS')process.exitCode=1;
 if(selected.size)assert.equal(report.checks.length,selected.size,'Unknown Carrier124 case identifier');
}finally{await mkdir(evidenceDir,{recursive:true});await writeFile(join(evidenceDir,'business-api-real.json'),JSON.stringify(report,null,2)+'\n');}
