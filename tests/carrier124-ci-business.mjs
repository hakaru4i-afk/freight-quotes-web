import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-carrier124nov18';
const sessions=JSON.parse(await readFile('/tmp/freight-carrier124-ci/sessions.json','utf8'));
const evidence={target:'freight-api-qa-carrier124nov18',source:'live Supabase isolated QA v5',checks:[],timestamp:new Date().toISOString()};
const call=async(actor,path,body,query={})=>{
 const url=new URL(base+path);
 for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
 const method=body===undefined?'GET':'POST';
 const multipart=body instanceof FormData;
 let r;
 for(let attempt=1;attempt<=(method==='GET'?3:1);attempt++){
   try{
     r=await fetch(url.toString(),{method,redirect:'follow',headers:{Origin:'https://hakaru4i-afk.github.io',...(actor?{Authorization:'Bearer '+sessions[actor]}:{}),...(body!==undefined&&!multipart?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
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
 evidence.checks.push({actor:actor||'anonymous',path,method,status:r.status});
 return{status:r.status,data};
};
try{
 const health=await call(null,'/health');
 assert.equal(health.status,200);
 assert.equal(health.data.qaRun,'carrier124nov18');
 assert.equal(health.data.projectRef,'ibclzdkxiozbzmniiygv');
 assert.equal(health.data.environment,'staging');
 assert.ok([401,403].includes((await call(null,'/api/carrier')).status));
 const a=await call('carrierA','/api/carrier'),b=await call('carrierB','/api/carrier');
 assert.equal(a.status,200);assert.equal(b.status,200);
 assert.ok(Array.isArray(a.data.notifications));assert.ok(Array.isArray(b.data.notifications));
 const order='QA-N26-OIDC-'+process.env.GITHUB_RUN_ID;
 assert.match(order,/^QA-N26-OIDC-[0-9]+$/);
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Minsk',dateStyle:'short',timeStyle:'short'});
 const deadline=fmt.format(Date.now()+86400000).replace(' ','T');
 const logistics={sender_contact:'OIDC synthetic owner',origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:'E2E synthetic freight',weight:'1250',volume:'12.5',ready_date:'2099-12-01',incoterm:'EXW',incoterm_place:'Synthetic Brest gate',dangerous_goods:'no'};
 const attachment=new FormData();
 attachment.set('order',order);
 attachment.append('files',new Blob(['Isolated OIDC acceptance '+order+'\n'],{type:'text/plain'}),'qa-control.txt');
 const uploaded=await call('owner','/api/documents',attachment);
 assert.equal(uploaded.status,200,'isolated QA attachment failed HTTP '+uploaded.status+' '+String(uploaded.data.error||''));
 const publish=await call('owner','/api/requests',{order,deadline,summary:'Isolated QA OIDC '+order,bitrixTask:'910083,910084',logistics});
 assert.equal(publish.status,200,'owner request create failed HTTP '+publish.status+' '+String(publish.data.error||publish.data.message||''));
 evidence.order=order;
 const carrier=await call('carrierA','/api/requests',undefined,{order});
 assert.equal(carrier.status,200);
 assert.equal(carrier.data.request.order_code,order);
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