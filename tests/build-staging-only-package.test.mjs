import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {buildStagingOnlyPackage,qaTransport,SOURCE_SHA,API_SHA,API_BUNDLE} from '../scripts/release/build-staging-only-package.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(fn){
 const root=mkdtempSync(join(tmpdir(),'sh59-staging-'));
 try {
  const base=join(root,'prod'),tested=join(root,'verified','test'),out=join(root,'out');
  mkdirSync(base,{recursive:true});mkdirSync(tested,{recursive:true});
  const put=(dir,n,v)=>writeFileSync(join(dir,n),v);
  for(const name of ['index.html','app.js','build-info.json','site-status.json','production-release-manifest.json'])put(base,name,'EXACT_PRODUCTION_'+name);
  const html='<html><head><script src="./staging-transport-20261111.js?v=e01e01ca2a49"></script></head><body><script src="./app.js"></script></body></html>';
  put(tested,'index.html',html);put(tested,'app.js','APP_SOURCE_BYTE_ID');put(tested,'staging-manifest.json','{}');
  put(tested,'staging-transport-20261111.js','/* Fixed staging host only. */');
  const lock={state:'TESTED_SOURCE_HANDOFF_NOT_DEPLOYED',frontendSha:SOURCE_SHA,backendSha:API_SHA,apiBundleSha256:API_BUNDLE,apiVersion:20,businessVersion:'SH-01.30.59 v',verifiedScenarios:37,productionAuthorized:false,requiresExplicitOwnerApproval:true,assets:Object.fromEntries(['index.html','app.js','staging-manifest.json'].map(n=>['test/'+n,sha(readFileSync(join(tested,n)))]))};
  const lockFile=join(root,'lock.json');writeFileSync(lockFile,JSON.stringify(lock));
  mkdirSync(join(base,'imported','test'),{recursive:true});writeFileSync(join(base,'imported','test','secret.json'),'SHOULD_NOT_BE_PUBLISHED');
  mkdirSync(join(base,'verified-handoff'),{recursive:true});writeFileSync(join(base,'verified-handoff','lock.json'),'SHOULD_NOT_BE_PUBLISHED');
  return fn({base,tested,out,lock,lockFile,root});
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('preserves all original production sentinel assets byte for byte and imports locked test source',()=>fixture(({base,tested,out,lockFile})=>{
 const p=buildStagingOnlyPackage(base,tested,lockFile,out);
 for(const n of ['index.html','app.js','build-info.json','site-status.json','production-release-manifest.json'])
   assert.deepEqual(readFileSync(join(base,n)),readFileSync(join(out,n)),n);
 assert.deepEqual(readFileSync(join(tested,'app.js')),readFileSync(join(out,'test','app.js')));
 assert.ok(!existsSync(join(out,'imported')),'CI imports must never be public');
 assert.ok(!existsSync(join(out,'verified-handoff')),'Handoff private evidence must never be public');
 assert.equal(p.isolatedQaApiVersion,20);
 assert.equal(p.stagingBundleRebindRequiresFreshE2E,true);
 assert.match(readFileSync(join(out,'test','index.html'),'utf8'),/staging-transport-20261111\.js\?v=[a-f0-9]{12}/);
 assert.ok(!readFileSync(join(out,'test','index.html'),'utf8').includes('e01e01ca2a49'));
 assert.equal(JSON.parse(readFileSync(join(out,'test','sh59-qa-pair.json'))).productionAuthorized,false);
}));
test('refuses unsigned assets and wrong backend binding',()=>fixture(({base,tested,out,lockFile,lock})=>{
 writeFileSync(join(tested,'app.js'),'CORRUPTED');
 assert.throws(()=>buildStagingOnlyPackage(base,tested,lockFile,out),/LOCKED_ASSET_MISMATCH/);
 writeFileSync(join(tested,'app.js'),'APP_SOURCE_BYTE_ID');
 lock.apiBundleSha256='f'.repeat(64);writeFileSync(lockFile,JSON.stringify(lock));
 assert.throws(()=>buildStagingOnlyPackage(base,tested,lockFile,out),/WRONG_TESTED_BACKEND_BUNDLE/);
}));
test('browser binding directs only /api and shared freight-api to isolated v20 and blocks raw staging data',async()=>{
 const requests=[];
 const ctx={location:{origin:'https://hakaru4i-afk.github.io',pathname:'/freight-quotes-web/test/',href:'https://hakaru4i-afk.github.io/freight-quotes-web/test/'},window:{fetch:async (u)=>{requests.push(String(u));return {status:200};}},URL,Request,Promise,Error,console};
 vm.runInNewContext(qaTransport(),ctx,{timeout:1000});
 await ctx.window.fetch('https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/health');
 await ctx.window.fetch('/api/quotes');
 assert.ok(requests[0].includes('/functions/v1/freight-api-qa-carrier124nov18/health'));
 assert.ok(requests[1].includes('/functions/v1/freight-api-qa-carrier124nov18/api/quotes'));
 assert.equal(requests.length,2);
 await assert.rejects(()=>ctx.window.fetch('https://ibclzdkxiozbzmniiygv.supabase.co/rest/v1/requests'),/QA20_SHARED_DATA_ENDPOINT_BLOCKED/);
 assert.equal(requests.length,2);
});