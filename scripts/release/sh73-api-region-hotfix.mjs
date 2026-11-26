import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const dir=process.argv[2]||'.hotfix-pages',mode=process.argv[3]||'prepare';
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const manifest='production-release-manifest.json',transport='staging-transport-20261111.js';
const digest=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(join(dir,p));
const live=async p=>{const r=await fetch(base+p+'?sh73fix='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});assert.ok(r.ok,p+' HTTP '+r.status);return Buffer.from(await r.arrayBuffer())};
const m=JSON.parse(read(manifest));
assert.equal(m.businessVersion,'SH-01.30.73 v');
assert.equal(m.apiFunction,'freight-api-release-83fd49986d138ab80c0ae7b96b970b64');
assert.equal(m.frontendSourceCommit,'c8e984e749b9283e053360ec5e11a1147f106044');
assert.equal(m.backendSourceCommit,'8af962470a2aed1c35457b234ceb36666cd2ed64');
for(const [p,h] of Object.entries(m.assets)){
 assert.ok(!p.startsWith('/')&&!p.split('/').includes('..')&&!p.includes('\\'));
 assert.equal(digest(read(p)),h,p);
}
if(mode==='prepare'){
 assert.deepEqual(await live(manifest),read(manifest),'LIVE_RELEASE_CHANGED');
 const prev=read(transport).toString('utf8'),replacement=readFileSync(transport,'utf8');
 const before='freight-api(?:\\/|$)',after='freight-api(?:-release-[a-f0-9]{32})?(?:\\/|$)';
 assert.equal(prev.replace(before,after).replace('Fixed staging host only.','Fixed production host and exact versioned release endpoints.'),replacement);
 const html=read('index.html').toString('utf8'),rx=/(staging-transport-20261111\.js\?v=)[a-f0-9]{12,40}/g;
 assert.equal([...html.matchAll(rx)].length,1);
 const key=digest(replacement).slice(0,20);
 const next=html.replace(rx,(_,p)=>p+key);
 writeFileSync(join(dir,transport),replacement);
 writeFileSync(join(dir,'index.html'),next);
 m.assets[transport]=digest(replacement);m.assets['index.html']=digest(next);
 m.emergencyHotfix={id:'SH73-P0-API-REGION',baseRunId:'45818064696',sourceCommit:process.env.GITHUB_SHA,changedAssets:[transport,'index.html'],dataChanged:false,apiChanged:false,versionChanged:false,appliedAt:new Date().toISOString()};
 writeFileSync(join(dir,manifest),JSON.stringify(m,null,2)+'\n');
}else if(mode==='verify'){
 let last;
 for(let i=0;i<15;i++){try{
  for(const p of [manifest,transport,'index.html','app.js','test/index.html'])assert.deepEqual(await live(p),read(p),p);
  const r=await fetch('https://ooclsrndeygojtofuyte.supabase.co/functions/v1/'+m.apiFunction+'/health?forceFunctionRegion=eu-central-1',{signal:AbortSignal.timeout(15000)});
  assert.ok(r.ok);const h=await r.json();assert.equal(h.frontendSha,m.frontendSourceCommit);assert.equal(h.backendSha,m.backendSourceCommit);console.log('SH73_TARGETED_LIVE_READBACK_PASS');last=null;break;
 }catch(e){last=e;await new Promise(r=>setTimeout(r,5000));}}
 if(last)throw last;
}else throw Error('unknown mode');
