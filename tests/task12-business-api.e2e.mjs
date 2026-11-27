// Actual isolated QA HTTP requests. No fixture can target staging or production.
// API-only results remain API-only; browser acceptance is recorded separately.
import assert from 'node:assert/strict';
import {appendFile,readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {fixtureSummary,latePenaltyCorrection,modeCheck,tenderCheck} from './helpers/isolated-qa-acceptance.mjs';
const base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const root='/tmp/freight-ci-qa',sessions=JSON.parse(await readFile(root+'/sessions.json','utf8')),actors=JSON.parse(await readFile(root+'/actors.json','utf8'));
assert.equal(process.env.GITHUB_REPOSITORY,'hakaru4i-afk/freight-quotes-web');assert.equal(process.env.GITHUB_REF,'refs/heads/main');assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);
for(const [id,a]of Object.entries(actors))assert.equal(a.login,'rc20261110-'+id.toLowerCase());
const proofFile=process.env.QA_BROWSER_BACKEND_PROOF_FILE;
const runtime=proofFile?JSON.parse(await readFile(proofFile,'utf8')):undefined;
const report={startedAt:new Date().toISOString(),runtime,runAttempt:process.env.GITHUB_RUN_ATTEMPT,environment:'isolated-qa',mode:'AUTHENTICATED_QA_API',runId:process.env.GITHUB_RUN_ID,frontendSha:runtime?.frontendSha||process.env.GITHUB_SHA,productionDataUsed:false,checks:[],calls:[]};
async function call(actor,path,body,method){
 const url=new URL(base+path);url.searchParams.set('forceFunctionRegion','eu-central-1');const multipart=body instanceof FormData;
 const verb=method||(body?'POST':'GET');
 const r=await fetch(url,{method:verb,headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor],...(multipart?{}:{'Content-Type':'application/json'})},body:multipart?body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});
 const context={actor,path:url.pathname.slice(new URL(base).pathname.length),method:verb,status:r.status,requestId:r.headers.get('x-freight-request-id')};
 if(typeof body?.action==='string')context.action=body.action;
 report.calls.push(context);return {status:r.status,data:await r.json(),context};
}
function ok(result){
 if(result.status!==200){
  const {data,context}=result;
  const reason=/Service Level|недоступен для выполнения заявки|согласуйте перевозчика/i.test(data.error ?? '')?'CARRIER_ELIGIBILITY_OR_ADMISSION':undefined;
  throw Object.assign(new Error('QA_HTTP_STATUS_MISMATCH'),{code:'QA_HTTP_STATUS_MISMATCH',actual:result.status,expected:200,context:{...context,reason}});
 }
 return result.data;
}
async function check(id,run){const entry={id,status:'FAIL',mode:'AUTHENTICATED_QA_API'};report.checks.push(entry);try{entry.evidence=await run();entry.status='PASS';console.log('QA_BUSINESS_API_PASS',id);}catch(e){entry.errorType=e.code||e.name;for(const key of ['actual','expected'])if(['number','boolean'].includes(typeof e[key]))entry[key]=e[key];if(e.context)entry.http=e.context;console.log('QA_BUSINESS_API_FAIL',id,JSON.stringify({errorType:entry.errorType,actual:entry.actual,expected:entry.expected,http:entry.http}));process.exitCode=1;}}
const makeOrder=kind=>'QA-CI-'+process.env.GITHUB_RUN_ID+'-'+kind+'-'+randomUUID().slice(0,8).toUpperCase();
const logistics={sender_contact:'Synthetic QA sender',origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:'Synthetic QA pallets',volume:'12.5',weight:'1250',ready_date:'2099-12-01',incoterm:'EXW',incoterm_place:'Brest warehouse',dangerous_goods:'no'};
async function upload(order,name,bytes){const f=new FormData();f.set('order',order);f.append('files',new Blob([bytes]),name);return ok(await call('owner','/api/documents',f));}
async function create(order,sourceLogistics=logistics){await upload(order,'qa-required.txt','Synthetic QA attachment');const data=ok(await call('owner','/api/requests',{order,summary:fixtureSummary,deadline:'2099-12-15T12:00',bitrixTask:'910001,910002',logistics:sourceLogistics}));assert.equal(data.recipients,2);return data;}
const variant=(amount=1500)=>({mode:'Авто',currency:'USD',amount,pickup:'2099-12-05',days:21,insurance:'Включено',includes:'Transport and documents',extras:'No extras',validUntil:'2099-12-20',incotermPlace:'Brest warehouse',dangerousGoods:'no',note:'Synthetic isolated QA offer',requestId:randomUUID()});
const carriers=['carrierA','carrierB'];
async function verifyFixturePolicies(){
 const policies=await Promise.all(carriers.map(async actor=>{
  const login=actors[actor].login;
  const {policy,events,revision}=ok(await call('owner','/api/service-level?login='+encodeURIComponent(login)));
  assert.equal(policy.login,login);
  assert.ok(Number.isInteger(policy.score));
  const observed={actor,score:policy.score,blocked:policy.blocked,tenderEligible:policy.tenderEligible,revision};
  if(!policy.tenderEligible){
   observed.unreconciledLateOrders=events.filter(event=>event.login===login&&event.actor==='system'&&event.kind==='no_response'&&
    event.source_kind==='request'&&Number(event.requested_delta)===-3&&!event.corrected&&
    /^QA-CI-\d{1,18}-LATE-[A-F0-9]{8}$/.test(event.order_code)&&
    /^response-missing:[a-f0-9-]{36}$/.test(event.event_key)).map(event=>({
     order:event.order_code,round:event.source_id,eventId:event.id,notificationId:event.event_key.split(':')[1],
    }));
  }
  return observed;
 }));
 console.log('QA_CARRIER_FIXTURE_POLICIES',JSON.stringify(policies.map(({actor,score,blocked,tenderEligible})=>({actor,score,blocked,tenderEligible}))));
 if(process.argv.includes('--preflight')){
  await mkdir('reports/isolated-rc',{recursive:true});
  await writeFile('reports/isolated-rc/business-fixture-preflight.json',JSON.stringify({runId:report.runId,runAttempt:report.runAttempt,runtime,policies},null,2)+'\n');
 }
 assert.ok(policies.every(policy=>policy.tenderEligible===true&&policy.blocked===false),'DATA_FIXTURE_ERROR:QA_CARRIERS_MUST_BE_TENDER_ELIGIBLE');
}
async function cleanForcedDeadline(order,round,notifications){
 assert.equal(process.env.GITHUB_ACTIONS,'true','PROTECTED_QA_WORKFLOW_REQUIRED');
 assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch','PROTECTED_QA_WORKFLOW_REQUIRED');
 assert.equal(process.env.GITHUB_WORKFLOW_REF,'hakaru4i-afk/freight-quotes-web/.github/workflows/isolated-qa-oidc-browser.yml@refs/heads/main','PROTECTED_QA_WORKFLOW_REQUIRED');
 assert.equal(runtime?.function,'freight-api-qa-rc20261110','ATTESTED_ISOLATED_QA_RUNTIME_REQUIRED');
 const ownerFixture=ok(await call('owner','/api/requests?order='+encodeURIComponent(order))).request;
 const results=await Promise.allSettled(carriers.map(async actor=>{
  const login=actors[actor].login,path='/api/service-level?login='+encodeURIComponent(login);
  const ledger=ok(await call('owner',path));
  const scope={request:ownerFixture,notification:notifications[actor],login,order,round,runId:report.runId};
  const command=latePenaltyCorrection({...scope,ledger});
  if(!command)return null;
  ok(await call('owner','/api/service-level',command));
  const confirmed=ok(await call('owner',path));
  assert.equal(latePenaltyCorrection({...scope,ledger:confirmed}),null,'QA_FIXTURE_CORRECTION_NOT_CONFIRMED');
  assert.ok(confirmed.corrections.some(receipt=>receipt.id===command.requestId&&receipt.event_id===command.eventId&&receipt.action==='void_event'),'QA_FIXTURE_CORRECTION_RECEIPT_MISSING');
  return {actor,order,penaltyEventId:command.eventId,correctionId:command.requestId};
 }));
 report.fixtureCorrections=results.filter(result=>result.status==='fulfilled'&&result.value).map(result=>result.value);
 const failed=results.find(result=>result.status==='rejected');
 if(failed)throw failed.reason;
}
if(process.argv.includes('--preflight')){
 await verifyFixturePolicies();
}else try{
 await check('required_fields_server_negatives',async()=>{const order=makeOrder('REQUIRED');await upload(order,'qa-validation.txt','Synthetic negative validation');const fields=['sender_contact','origin','destination','cargo','volume','ready_date','incoterm','dangerous_goods'];for(const field of fields){const r=await call('owner','/api/requests',{order,deadline:'2099-12-15T12:00',logistics:{...logistics,[field]:field==='dangerous_goods'?'unknown':''}});assert.equal(r.status,400);assert.ok(r.data.fields.includes(field));}return{rejectedFields:fields,serverRejectsMissingFields:true};});
 await check('published_fields_files_and_incoterms_survive_owner_edit',async()=>{
  const order=makeOrder('DOCUMENTS');await create(order);const bytesA=Buffer.from('Synthetic multi-file A'),bytesB=Buffer.from('Synthetic multi-file B'),form=new FormData();form.set('order',order);form.append('files',new Blob([bytesA]),'qa-multi-a.txt');form.append('files',new Blob([bytesB]),'qa-multi-b.txt');ok(await call('owner','/api/documents',form));const docs=ok(await call('owner','/api/documents?order='+order));assert.equal(docs.files.length,3);const before=ok(await call('owner','/api/requests?order='+order)).request;assert.match(before.registration_no,/TR-/);assert.deepEqual(before.bitrix_task.split(/[,;\s]+/).filter(Boolean),['910001','910002']);const fields={...logistics,cargo:'Synthetic edited cargo'};delete fields.sender_contact;delete fields.incoterm_place;const body={action:'save_logistics',order,roundId:before.round_id,expectedRevision:Number(before.logistics_revision),logistics:fields};for(const actor of['carrierA','carrierB','ved','supplier'])assert.equal((await call(actor,'/api/requests',body)).status,403);ok(await call('owner','/api/requests',body));assert.equal((await call('owner','/api/requests',body)).status,409);for(const actor of['owner','carrierA','carrierB']){const after=ok(await call(actor,'/api/requests?order='+order)).request;assert.equal(after.cargo,fields.cargo);for(const key of['origin','destination','weight','volume','ready_date','sender_contact','incoterm','incoterm_place','round_id','bitrix_task','registration_no'])assert.equal(after[key],before[key]);const access=actor==='owner'?docs.access:ok(await call(actor,'/api/carrier')).notifications.find(x=>x.order_code===order)?.access_token;assert.ok(access);if(actor!=='owner')assert.equal((await call(actor,'/api/documents?order='+order)).status,403);assert.equal(ok(await call(actor,'/api/documents?order='+order+'&access='+encodeURIComponent(access))).files.length,3);}const a=docs.files.find(x=>x.name==='qa-multi-a.txt'),b=docs.files.find(x=>x.name==='qa-multi-b.txt');assert.ok(a&&b);for(const actor of['owner','carrierA','carrierB']){const access=actor==='owner'?docs.access:ok(await call(actor,'/api/carrier')).notifications.find(x=>x.order_code===order)?.access_token;assert.ok(access);const r=await fetch(base+'/api/documents/file?id='+a.id+'&access='+encodeURIComponent(access)+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]},signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);report.calls.push({actor,path:'/api/documents/file',method:'GET',status:r.status,requestId:r.headers.get('x-freight-request-id'),download:true});assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytesA);}assert.equal((await call('carrierA','/api/documents',{action:'remove',order,id:b.id})).status,403);assert.equal(ok(await call('owner','/api/documents',{action:'remove',order,id:b.id})).removed,true);assert.equal(ok(await call('owner','/api/documents',{action:'remove',order,id:b.id})).removed,false);assert.equal(ok(await call('owner','/api/documents?order='+order)).files.length,2);report.editedRequest={order,cargo:fields.cargo};return{order,ownerOnlyEdit:true,staleEditDenied:true,sourceFieldsAndIncotermPlacePreserved:true,bitrixNumbers:2,uploadedTogether:2,downloadedByRoles:3,sha256:createHash('sha256').update(bytesA).digest('hex'),removedOnce:true};
 });
 await check('timely_refusal_requires_reason_and_never_penalizes_service_level',async()=>{
  const order=makeOrder('REFUSAL');await create(order);const before=ok(await call('carrierA','/api/service-level'));assert.equal((await call('carrierA','/api/decline',{order,reason:''})).status,400);assert.equal((await call('owner','/api/decline',{order,reason:'Synthetic timely refusal'})).status,403);ok(await call('carrierA','/api/decline',{order,reason:'Synthetic timely refusal: equipment unavailable'}));let after=ok(await call('carrierA','/api/service-level'));assert.equal(after.policy.score,before.policy.score);assert.equal(after.events.filter(x=>x.order_code===order).length,0);ok(await call('carrierA','/api/decline',{order,action:'resume'}));after=ok(await call('carrierA','/api/service-level'));assert.equal(after.policy.score,before.policy.score);return{order,emptyReasonDenied:true,ownerCannotImpersonateCarrier:true,timelyRefusalNoPenalty:true,resumedBeforeDeadline:true};
 });
 await check('multiple_variants_currency_edit_and_stale_write',async()=>{
  const order=makeOrder('VARIANTS');await create(order);const a=variant(),b=variant(1650);const request={order,carrier:'Synthetic carrier A',contact:'Synthetic QA contact',consent:true,variants:[a,b]};ok(await call('carrierA','/api/quote',request));ok(await call('carrierA','/api/quote',request));let data=ok(await call('owner','/api/data'));const rows=data.bids.filter(x=>x.order_code===order);assert.equal(rows.length,2);const original=rows.find(x=>x.request_id===a.requestId);assert.ok(original);const edit={...original,expected:original,amount:1600,currency:'EUR'};for(const actor of ['carrierA','carrierB','ved'])assert.equal((await call(actor,'/api/bids',edit,'PATCH')).status,403);ok(await call('owner','/api/bids',edit,'PATCH'));const current=ok(await call('owner','/api/data')).bids.find(x=>x.id===original.id);assert.equal(Number(current.amount),1600);assert.equal(current.currency,'EUR');for(const k of ['route','origin','destination','weight','order_code','round_id','bitrix_task'])assert.equal(current[k],original[k]);assert.equal((await call('owner','/api/bids',edit,'PATCH')).status,409);return{order,variants:2,replayDidNotDuplicate:true,currency:'EUR',staleWrite:409,forbiddenRoles:3,sourceFieldsPreserved:true};
 });
 let forcedDeadline;
 await check('late_preparation_blocks_winner_and_submitted_offer_stays_reviewable',async()=>{
  const order=makeOrder('LATE'),{round}=await create(order);const b=variant(1400);ok(await call('carrierB','/api/quote',{order,carrier:'Synthetic timely carrier',contact:'Synthetic QA contact',variants:[b]}));
  const data=ok(await call('owner','/api/registry?kind=request&id='+encodeURIComponent(round)));
  assert.deepEqual([data.item.id,data.item.order_code,data.item.summary],[round,order,fixtureSummary]);
  const notifications=Object.fromEntries(carriers.map(actor=>{
   const notice=data.recipients.find(row=>row.recipient===actors[actor].login);
   assert.ok(notice,'CURRENT_QA_NOTIFICATION_REQUIRED');
   return [actor,notice];
  }));
  const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);assert.equal(identityUrl.protocol,'https:');identityUrl.searchParams.set('audience','freight-isolated-qa-credentials');const identityResponse=await fetch(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(30000)});assert.equal(identityResponse.status,200);const identity=(await identityResponse.json()).value;assert.ok(identity);
  forcedDeadline={order,round,notifications};
  const expire=await fetch('https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-qa-credential-broker',{method:'POST',headers:{Authorization:'Bearer '+identity,'Content-Type':'application/json'},body:JSON.stringify({action:'expire_fixture_deadline',actor:'owner',order}),redirect:'error',signal:AbortSignal.timeout(45000)});assert.equal(expire.status,200);assert.equal((await expire.json()).fixtureExpired,true);
  const n=ok(await call('carrierA','/api/carrier')).notifications.find(x=>x.order_code===order);assert.ok(n);const prepare={action:'start',order,notificationId:n.id};ok(await call('carrierA','/api/late-bid-drafts',prepare));ok(await call('carrierA','/api/late-bid-drafts',prepare));const before=ok(await call('carrierA','/api/service-level'));assert.ok(Number.isFinite(Number(before.policy.score)));assert.equal(before.events.filter(e=>e.order_code===order).length,1);
  let bid=ok(await call('owner','/api/data')).bids.find(x=>x.order_code===order&&x.request_id===b.requestId);assert.ok(bid);ok(await call('owner','/api/review',{id:bid.id,decision:'accepted'}));bid=ok(await call('owner','/api/data')).bids.find(x=>x.id===bid.id);const notice=ok(await call('carrierB','/api/carrier')).notifications.find(x=>x.order_code===order);const select={id:notice.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid};const blocked=await call('owner','/api/offer-selection',select);assert.equal(blocked.status,409);assert.match(blocked.data.error,/подготов|поздн/i);
  const a=variant(1700),a2=variant(1800);ok(await call('carrierA','/api/quote',{order,carrier:'Synthetic late carrier',contact:'Synthetic QA contact',variants:[a,a2]}));const late=ok(await call('owner','/api/data')).bids.filter(x=>x.order_code===order&&[a.requestId,a2.requestId].includes(x.request_id));assert.equal(late.length,2);for(const row of late){assert.equal(Number(row.late),1);assert.equal(row.decision,'pending');}for(const [i,row]of late.entries())ok(await call('owner','/api/review',{id:row.id,decision:i?'rejected':'accepted',reason:'Synthetic explicit late-offer review'}));const after=ok(await call('carrierA','/api/service-level'));assert.equal(after.policy.score,before.policy.score,'A late bid must not restore the missed-deadline penalty');const events=after.events.filter(e=>e.order_code===order);assert.equal(events.filter(e=>e.kind==='no_response').length,1,'The missed deadline is penalized once');assert.equal(events.filter(e=>e.kind==='late_response_after_no_response').length,1,'The later submission has one separate informational audit');assert.equal(events.find(e=>e.kind==='late_response_after_no_response').delta,0);assert.equal(events.reduce((sum,e)=>sum+Number(e.delta),0),before.events.filter(e=>e.order_code===order).reduce((sum,e)=>sum+Number(e.delta),0),'The informational audit must not change the penalty');ok(await call('owner','/api/offer-selection',select));return{order,fixtureDeadlineOnly:true,applicationClockUnchanged:true,activePreparationWinnerStatus:409,lateVariants:2,explicitOwnerDecisions:['accepted','rejected'],winnerSelectedAfterSubmission:true,lateBidDoesNotRestoreScore:true,onePenaltyEvent:true};
 });
 if(forcedDeadline){
  try{
   await cleanForcedDeadline(forcedDeadline.order,forcedDeadline.round,forcedDeadline.notifications);
   const late=report.checks.find(check=>check.id==='late_preparation_blocks_winner_and_submitted_offer_stays_reviewable');
   if(late.status==='PASS'){
    assert.ok(report.fixtureCorrections.some(correction=>correction.actor==='carrierA'&&correction.order===late.evidence.order));
    late.evidence.qaPenaltyNeutralized=true;
   }
   await verifyFixturePolicies();
  }catch(error){
   report.fixtureCleanup={status:'FAIL',type:'DATA_FIXTURE_ERROR',code:error.code||error.name};
   console.log('QA_FIXTURE_CLEANUP_FAIL',JSON.stringify(report.fixtureCleanup));
   throw error;
  }
 }
 await check(modeCheck,async()=>{
  const shipments=[];for(const item of[{tag:'SEA',mode:'Море',origin:'Китай, Нинбо',destination:'Россия, Владивосток',location:'Китай, Нинбо, порт Ningbo Zhoushan Port'},{tag:'AIR',mode:'Авиа',origin:'Китай, Пекин',destination:'Германия, Франкфурт-на-Майне',location:'Германия, Франкфурт-на-Майне, аэропорт Frankfurt Airport'},{tag:'MULTI',mode:'Мультимодальная',origin:'Китай, Нинбо',destination:'Беларусь, Минск',location:'Россия, Забайкальск, станция Забайкальск'}]){
   const order=makeOrder(item.tag),lg={...logistics,origin:item.origin,destination:item.destination};await create(order,lg);const quote={...variant(1500),mode:item.mode};ok(await call('carrierA','/api/quote',{order,carrier:'Synthetic mode carrier',contact:'Synthetic QA contact',variants:[quote]}));let bid=ok(await call('owner','/api/data')).bids.find(x=>x.order_code===order&&x.request_id===quote.requestId);assert.ok(bid);ok(await call('owner','/api/review',{id:bid.id,decision:'accepted'}));bid=ok(await call('owner','/api/data')).bids.find(x=>x.id===bid.id);const notice=ok(await call('carrierA','/api/carrier')).notifications.find(x=>x.order_code===order);ok(await call('owner','/api/offer-selection',{id:notice.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid}));ok(await call('carrierA','/api/task2',{order,action:'take'}));ok(await call('carrierA','/api/task2',{order,action:'actual_departure',date:'2026-11-02T06:00:00+03:00'}));const point={order,action:'save',fields:{location:item.location,location_date:'2026-11-13T06:00:00+03:00',location_comment:'Synthetic mode-specific tracking observation'}};ok(await call('carrierA','/api/task2',point));const d=ok(await call('carrierA','/api/task2?order='+order));ok(await call('carrierA','/api/task2',point));const after=ok(await call('carrierA','/api/task2?order='+order));assert.deepEqual(after.points.map(x=>x.id),d.points.map(x=>x.id));assert.equal(d.shipment.mode,item.mode);assert.equal(d.points.length,1);assert.ok(d.state.actual_departure);assert.equal((await call('carrierB','/api/task2?order='+order)).status,403);assert.equal((await call('supplier','/api/task2?order='+order)).status,403);assert.equal((await call('ved','/api/task2?order='+order)).status,200);shipments.push({order,mode:item.mode,tag:item.tag,pointIds:d.points.map(x=>x.id),geocodeStatus:d.points[0].geocode?.status||'unverified'});
  }report.modeShipments=shipments;return{shipments,unchangedReplay:true,roleDenials:true};
 });
 await check(tenderCheck,async()=>{
  const order=makeOrder('TENDER'),body={action:'create',order,title:'Synthetic QA price tender',criteria:'Lowest eligible total price',mode:'price',currency:'USD',deadline:'2099-12-20T12:00',step:15,ceiling:2000,extension:false,participants:[actors.carrierA.login,actors.carrierB.login],origin:'Brest, Belarus',destination:'Minsk, Belarus',grossWeight:'1250'};
  assert.equal((await call('carrierA','/api/tenders',body)).status,403);
  const {id,protocol:protocolNumber}=ok(await call('owner','/api/tenders',body));
  assert.ok(id&&protocolNumber);
  const a={action:'offer',id,requestId:randomUUID(),amount:1500,days:21,terms:'Synthetic QA transport'};
  ok(await call('carrierA','/api/tenders',a));
  const b={...a,requestId:randomUUID(),amount:1490};
  assert.equal((await call('carrierB','/api/tenders',b)).status,409);
  b.amount=1480;
  const {offerId}=ok(await call('carrierB','/api/tenders',b));
  assert.equal(ok(await call('carrierB','/api/tenders',b)).offerId,offerId);
  ok(await call('owner','/api/tenders',{action:'close',id,reason:'Synthetic early close after both offers'}));
  const d=ok(await call('owner','/api/tenders?id='+id)),winner=d.item.participants.find(p=>p.login===actors.carrierB.login);
  assert.ok(winner);
  ok(await call('owner','/api/tenders',{action:'finalize',id,winner:winner.id,reason:'Synthetic lowest eligible offer'}));
  const protocol=ok(await call('owner','/api/tenders?protocol='+id));
  assert.equal(protocol.final,true);
  const {tender,offers,events}=protocol.protocol;
  assert.deepEqual([tender.id,tender.order_code,tender.protocol,tender.title,tender.winner,tender.currency],
   [id,order,protocolNumber,body.title,winner.id,body.currency]);
  const winningOffer=offers.find(offer=>offer.id===offerId);
  assert.equal(Number(winningOffer?.amount),b.amount);
  assert.equal(winningOffer.participant_id,winner.id);
  assert.equal(winningOffer.decision,'accepted');
  assert.equal(events.filter(event=>event.type==='finalized').at(-1)?.detail.offer_id,offerId);
  assert.equal((await call('carrierA','/api/tenders?protocol='+id)).status,403);
  return {order,id,step:body.step,acceptedImprovement:a.amount-b.amount,duplicateOfferProtected:true,final:true,
   protocol:protocolNumber,title:body.title,winningAmount:b.amount,winningOffer:offerId,winner:winner.id,currency:body.currency};
 });
 await check('two_sessions_and_three_wrong_passwords',async()=>{
  const actor='certification',old=sessions[actor],created=[];for(let i=0;i<2;i++){const r=ok(await call(actor,'/api/auth',{action:'login',login:actors[actor].login,password:process.env.QA_CERTIFICATION_PASSWORD}));assert.match(r.sessionToken||'',/^[a-f0-9]{64}$/);created.push(r.sessionToken);}
  sessions[actor]=old;assert.equal((await call(actor,'/api/session')).data.authenticated,false);for(const token of created){sessions[actor]=token;assert.equal((await call(actor,'/api/session')).data.authenticated,true);}let r;for(let i=0;i<3;i++){r=await call(actor,'/api/auth',{action:'login',login:actors[actor].login,password:'Synthetic-deliberately-wrong-password'});assert.equal(r.status,401);}assert.equal(r.data.recoveryRequested,true);for(const token of created){sessions[actor]=token;ok(await call(actor,'/api/auth',{action:'logout'}));}sessions[actor]=old;return{oldSessionRevoked:true,maximumActiveSessions:2,wrongAttempts:3,recoveryRequested:true};
 });
 report.result=report.checks.length===8&&report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';if(report.result!=='PASS')process.exitCode=1;
}finally{
 report.completedAt=new Date().toISOString();
 await mkdir('reports/isolated-rc',{recursive:true});
 await writeFile('reports/isolated-rc/business-api-real.json',JSON.stringify(report,null,2)+'\n');
 if(process.env.GITHUB_OUTPUT){
  const ready=id=>report.checks.some(check=>check.id===id&&check.status==='PASS');
  await appendFile(process.env.GITHUB_OUTPUT,`mode_ready=${ready(modeCheck)}\ntender_ready=${ready(tenderCheck)}\n`);
 }
}
