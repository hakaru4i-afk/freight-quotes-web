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
 evidence.result='PASS';evidence.acceptance='Isolated QA actual OIDC API workflow, not full 37/37 browser acceptance';
 console.log('CARRIER124_OIDC_REAL_AUTH_BUSINESS_CHAIN_PASS',JSON.stringify({order,checks:evidence.checks.length}));
}catch(error){
 evidence.result='FAIL';evidence.error=String(error.message).slice(0,350);console.error('CARRIER124_OIDC_CHAIN_FAIL',evidence.error);process.exitCode=1;
}finally{
 await mkdir('reports',{recursive:true});await writeFile('reports/carrier124-ci-business.json',JSON.stringify(evidence,null,2));
}
