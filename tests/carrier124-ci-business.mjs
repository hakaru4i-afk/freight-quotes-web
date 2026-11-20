import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-carrier124nov18';
const sessions=JSON.parse(await readFile('/tmp/freight-carrier124-ci/sessions.json','utf8'));
const evidence={target:'freight-api-qa-carrier124nov18',businessVersion:'SH-01.30.59 v',checks:[],timestamp:new Date().toISOString()};
const call=async(actor,path,body,query={})=>{
 const url=new URL(base+path);
 for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
 url.searchParams.set('forceFunctionRegion','eu-central-1');
 const method=body===undefined?'GET':'POST';
 const multipart=body instanceof FormData;
 let r;
 for(let attempt=1;attempt<=(method==='GET'?3:1);attempt++){
   try{
     r=await fetch(url.toString(),{method,redirect:'error',headers:{Origin:'https://hakaru4i-afk.github.io',...(actor?{Authorization:'Bearer '+sessions[actor]}:{}),...(body!==undefined&&!multipart?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
     break;
   }catch(err){
     const cause=String(err?.cause?.code||err?.cause?.name||err?.code||err?.name||'NETWORK_ERROR').replace(/[^A-Z0-9_]/gi,'').slice(0,60);
     evidence.checks.push({actor:actor||'anonymous',path,method,attempt,status:'transport_error',cause});
     if(attempt===(method==='GET'?3:1))throw Error('API_TRANSPORT_FAILED_'+path+'_'+cause);
     await new Promise(resolve=>setTimeout(resolve,250*attempt));
   }
 }
 if(new URL(r.url).hostname!=='ibclzdkxiozbzmniiygv.supabase.co')throw Error('QA_API_REDIRECT_OUTSIDE_STAGING');
 const data=await r.json().catch(()=>({}));
 const requestId=r.headers.get('x-freight-request-id');
 evidence.checks.push({actor:actor||'anonymous',path,method,status:r.status,requestId});
 return{status:r.status,data,requestId};
};
try{
 const health=await call(null,'/health');
 assert.equal(health.status,200);
 assert.equal(health.data.qaRun,'carrier124nov18');
 assert.equal(health.data.projectRef,'ibclzdkxiozbzmniiygv');
 assert.equal(health.data.environment,'staging');
 assert.equal(health.data.release,evidence.businessVersion);
 assert.ok([401,403].includes((await call(null,'/api/carrier')).status));
 const a=await call('carrierA','/api/carrier'),b=await call('carrierB','/api/carrier');
 assert.equal(a.status,200);assert.equal(b.status,200);
 assert.ok(Array.isArray(a.data.notifications));assert.ok(Array.isArray(b.data.notifications));
 const order='QA-N26-OIDC-'+process.env.GITHUB_RUN_ID+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
 assert.match(order,/^QA-N26-OIDC-[0-9]+-[0-9]+$/);
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Minsk',dateStyle:'short',timeStyle:'short'});
 const deadline=fmt.format(Date.now()+86400000).replace(' ','T');
 const logistics={sender_contact:'OIDC synthetic owner',origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:'E2E synthetic freight',weight:'1250',volume:'12.5',ready_date:'2099-12-01',incoterm:'EXW',incoterm_place:'Synthetic Brest gate',dangerous_goods:'no'};
 const attachment=new FormData();
 attachment.set('order',order);
 attachment.append('files',new Blob(['Isolated OIDC acceptance '+order+'\n'],{type:'text/plain'}),'qa-control.txt');
 assert.equal(attachment.get('order'),order);
 assert.equal(attachment.getAll('files').length,1);
 const uploaded=await call('owner','/api/documents',attachment);
 assert.equal(uploaded.status,200,'isolated QA attachment failed HTTP '+uploaded.status+' '+String(uploaded.data.error||''));
 const publish=await call('owner','/api/requests',{order,deadline,summary:'Isolated QA OIDC '+order,bitrixTask:'910083,910084',logistics});
 assert.equal(publish.status,200,'owner request create failed HTTP '+publish.status+' '+String(publish.data.error||publish.data.message||''));
 evidence.order=order;
 const owner=await call('owner','/api/requests',undefined,{order});
 assert.equal(owner.status,200);
 const stored=owner.data.request;
 assert.equal(stored?.order_code,order);
 assert.match(publish.data.round,/^[0-9a-f-]{36}$/);
 assert.equal(stored.round_id,publish.data.round);
 assert.match(stored.registration_no,/^TR-\d{2}-\d{6}$/);
 assert.ok(owner.requestId,'The registration readback must have a real request ID');
 const readback={order,round:stored.round_id,registrationNo:stored.registration_no,requestId:owner.requestId};
 evidence.registration={...readback,sha256:createHash('sha256').update(JSON.stringify(readback)).digest('hex')};
 const carrier=await call('carrierA','/api/requests',undefined,{order});
 assert.equal(carrier.status,200);
 assert.equal(carrier.data.request.order_code,order);
 assert.equal(carrier.data.request.round_id,stored.round_id);
 assert.equal(carrier.data.request.registration_no,stored.registration_no);
 const bidRequest=randomUUID();
 const offer=await call('carrierA','/api/quote',{order,carrier:'Synthetic carrier A',contact:'QA contact',consent:true,variants:[{mode:'Авто',currency:'USD',amount:1400,pickup:'2099-12-05',days:21,insurance:'Включено',includes:'QA transport',extras:'No extras',validUntil:'2099-12-20',incotermPlace:'Synthetic Brest gate',dangerousGoods:'no',requestId:bidRequest}]});
 assert.equal(offer.status,200);
 const ownerData=await call('owner','/api/data');
 assert.equal(ownerData.status,200);
 const bid=ownerData.data.bids.find(x=>x.request_id===bidRequest);
 assert.ok(bid,'submitted offer missing');
 const review=await call('owner','/api/review',{id:bid.id,decision:'accepted'});
 assert.equal(review.status,200);
 const selected=(await call('carrierA','/api/carrier')).data.notifications.find(x=>x.order_code===order);
 assert.ok(selected,'Carrier notification missing');
 const chosen=await call('owner','/api/offer-selection',{id:selected.id,bidId:bid.id,requestId:randomUUID(),revision:0,reason:'',expected:bid});
 assert.equal(chosen.status,200);
 const taken=await call('carrierA','/api/task2',{action:'take',order});
 assert.equal(taken.status,200);

 // Independent real automatic remaining-km gate: exact facilities only, no city-centroid estimate.
 const exactFrom='Россия, Забайкальск, станция Забайкальск';
 const exactTo='Беларусь, Минск, Колядичи';
 const direct=await call('owner','/api/route-distance',{addresses:[exactFrom,exactTo],transport:'Авто'});
 assert.equal(direct.status,200,'Exact-facility road network must actually calculate');
 assert.equal(direct.data.estimated,false,'Estimated route can never replace verified AUTO-KM');
 assert.equal(direct.data.source,'OSRM / OpenStreetMap');
 assert.ok(Number.isFinite(direct.data.km)&&direct.data.km>0);
 assert.equal(direct.data.points.length,2);
 for(const p of direct.data.points){assert.equal(p.status,'resolved');assert.equal(p.precision,'facility');assert.equal(p.confirmed,true);assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));}
 const exactOrder='QA-MAP50-EXACT-'+process.env.GITHUB_RUN_ID+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
 const exactLogistics={...logistics,origin:exactFrom,destination:exactTo,incoterm_place:exactFrom,ready_date:'2026-11-01'};
 // Publication contract requires an attached document for EVERY new order.
 // The ordinary OIDC attachment belongs to a different order and cannot satisfy MAP50.
 const exactAttachment=new FormData();
 exactAttachment.set('order',exactOrder);
 exactAttachment.append('files',new Blob(['MAP50 exact-facility acceptance '+exactOrder+'\\n'],{type:'text/plain'}),'qa-map50-control.txt');
 const exactUploaded=await call('owner','/api/documents',exactAttachment);
 assert.equal(exactUploaded.status,200,'Exact fixture attachment failed HTTP '+exactUploaded.status+' '+String(exactUploaded.data.error||''));
 const exactPublished=await call('owner','/api/requests',{order:exactOrder,deadline,summary:'MAP50 exact remaining QA '+exactOrder,bitrixTask:'910081',logistics:exactLogistics});
 assert.equal(exactPublished.status,200,'Exact fixture request failed HTTP '+exactPublished.status+' '+String(exactPublished.data.error||exactPublished.data.message||''));
 const exactBidRequest=randomUUID();
 assert.equal((await call('carrierA','/api/quote',{order:exactOrder,carrier:'Exact QA carrier',contact:'QA contact',consent:true,variants:[{mode:'Авто',currency:'USD',amount:1400,pickup:'2026-11-02',days:21,insurance:'Включено',includes:'Road freight',extras:'No extras',validUntil:'2099-12-20',incotermPlace:exactFrom,dangerousGoods:'no',requestId:exactBidRequest}]})).status,200,'Exact fixture quote');
 const exactData=await call('owner','/api/data');assert.equal(exactData.status,200);
 const exactBid=exactData.data.bids.find(x=>x.request_id===exactBidRequest);assert.ok(exactBid,'Exact fixture quote readback');
 assert.equal((await call('owner','/api/review',{id:exactBid.id,decision:'accepted'})).status,200,'Exact fixture review');
 const exactCarrier=await call('carrierA','/api/carrier');assert.equal(exactCarrier.status,200);
 const exactNotification=exactCarrier.data.notifications.find(x=>x.order_code===exactOrder);assert.ok(exactNotification,'Exact fixture notification');
 assert.equal((await call('owner','/api/offer-selection',{id:exactNotification.id,bidId:exactBid.id,requestId:randomUUID(),revision:0,reason:'',expected:exactBid})).status,200,'Exact fixture award');
 assert.equal((await call('carrierA','/api/task2',{action:'take',order:exactOrder})).status,200,'Exact fixture take');
 assert.equal((await call('carrierA','/api/task2',{action:'save',order:exactOrder,fields:{actual_departure:'2026-11-02T06:00'}})).status,200,'Exact fixture departure');
 assert.equal((await call('carrierA','/api/task2',{action:'save',order:exactOrder,fields:{location:exactFrom,location_date:'2026-11-06T06:00'}})).status,200,'Exact fixture tracked checkpoint');
 const metric=await call('carrierA','/api/task2',undefined,{order:exactOrder});assert.equal(metric.status,200,'Exact fixture readback');
 assert.equal(metric.data.points.length,1);
 const point=metric.data.points[0],route=metric.data.route;
 assert.equal(point.geocode?.status,'resolved');assert.equal(point.geocode?.precision,'facility');assert.equal(point.geocode?.confirmed,true);
 assert.equal(point.route_calculation_status,'verified','Saved tracking point must be AUTO-KM verified');
 assert.ok(point.remaining_km!==null&&Number.isFinite(Number(point.remaining_km))&&Number(point.remaining_km)>=0,'Automatic point remaining_km');
 assert.ok(route&&!route.estimated,'Persisted metric must be exact');
 assert.equal(route.source,'OSRM / OpenStreetMap');
 assert.ok(Number.isFinite(Number(route.total_km))&&Number(route.total_km)>0);
 assert.ok(Math.abs(Number(route.total_km)-direct.data.km)<=0.2);
 assert.ok(route.remaining_km!==null&&Number.isFinite(Number(route.remaining_km))&&Number(route.remaining_km)>=0&&Number(route.remaining_km)<=Number(route.total_km));
 evidence.exactAutoKm={result:'PASS',order:exactOrder,facilityPoints:2,estimated:false,source:route.source,totalKm:Number(route.total_km),remainingKm:Number(route.remaining_km),trackingRemainingKm:Number(point.remaining_km),trackingStatus:point.route_calculation_status};
 console.log('MAP50_EXACT_AUTO_KM_PERSISTED_PASS',JSON.stringify(evidence.exactAutoKm));
 evidence.result='PASS';evidence.acceptance='Isolated QA actual OIDC API workflow, not full 37/37 browser acceptance';
 console.log('CARRIER124_OIDC_REAL_AUTH_BUSINESS_CHAIN_PASS',JSON.stringify({order,checks:evidence.checks.length}));
}catch(error){
 evidence.result='FAIL';evidence.error=String(error.message).slice(0,350);console.error('CARRIER124_OIDC_CHAIN_FAIL',evidence.error);process.exitCode=1;
}finally{
 await mkdir('reports',{recursive:true});await writeFile('reports/carrier124-ci-business.json',JSON.stringify(evidence,null,2));
}
