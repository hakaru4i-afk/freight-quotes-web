// Actual isolated API and authenticated synthetic sessions. No response mocks,
// production traffic, mutations, timeout changes or automatic retries.
import{readFile,mkdir,writeFile}from'node:fs/promises';import{execFileSync}from'node:child_process';
import assert from'node:assert/strict';
const base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const sessions=JSON.parse(await readFile(process.env.QA_SESSIONS_FILE,'utf8'));
const info=JSON.parse(await readFile('test/build-info.json','utf8')).stabilizationQa20261110;
const completed=JSON.parse(await readFile('reports/nov14-published/browser-results-owner.json','utf8')).roles[0];
const winner=completed.selection.winnerActor;assert.ok(['carrierA','carrierB'].includes(winner));
const report={status:'RUNNING',mocks:false,environment:'isolated-qa-rc20261110',frontendSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backendSourceCommit:info.backendSourceCommit,backendVersion:info.isolatedQaVersion,backendBundle:info.isolatedQaBundleSha256,startedAt:new Date().toISOString(),roles:[]};
const read=async(actor,path)=>{
 const start=performance.now(),r=await fetch(base+path,{headers:{Authorization:'Bearer '+sessions[actor],Origin:'https://hakaru4i-afk.github.io','Cache-Control':'no-store'},signal:AbortSignal.timeout(15000)});
 const body=await r.json();assert.equal(r.status,200,actor+' '+path.split('?')[0]+' HTTP '+r.status);
 return{body,metrics:{path:path.split('?')[0],status:r.status,durationMs:Math.round(performance.now()-start),region:r.headers.get('x-sb-edge-region')}};
};
await mkdir('reports/isolated-rc',{recursive:true});
try{
 for(const actor of ['owner',winner,'ved']){
  const list=await read(actor,'/api/task2');assert.ok(Array.isArray(list.body.items));
  const item=list.body.items.find(x=>x.order_code===completed.createdOrder);assert.ok(item,'The current full-chain shipment is required for '+actor);
  const rec={actor,samples:[]};report.roles.push(rec);
  for(let wave=0;wave<5;wave++){
   const values=await Promise.all(['/api/shipments','/api/chats','/api/task2?order='+encodeURIComponent(item.order_code)].map(path=>read(actor,path)));
   for(const v of values)rec.samples.push(v.metrics);
  }
  const times=rec.samples.map(x=>x.durationMs).sort((a,b)=>a-b);rec.p95Ms=times[Math.ceil(times.length*.95)-1];rec.maxMs=times.at(-1);
  assert.ok(rec.p95Ms<5000,actor+' p95 exceeded the 5-second response budget: '+rec.p95Ms);
 }
 report.status='PASS';
}catch(error){report.status='FAIL';throw error;}
finally{report.finishedAt=new Date().toISOString();await writeFile('reports/isolated-rc/issue99-real-performance.json',JSON.stringify(report,null,2)+'\n');console.log('ISSUE99_REAL_PERFORMANCE',JSON.stringify(report));}
