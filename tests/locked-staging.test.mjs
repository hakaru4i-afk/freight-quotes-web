import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {captureRoot,assertRootUnchanged,rootInventory,live} from '../scripts/release/locked-staging.mjs';
import {digest} from '../scripts/release/locked-release.mjs';

test('capture and preserve only exact published production root, never candidate root',async()=>{
 const names=['index.html','app.js','style.css','build-info.json','site-status.json'],files=new Map(names.map(n=>[n,Buffer.from(n)]));
 const manifest={environment:'production',publicationState:'PUBLISHED',assets:Object.fromEntries([...files].map(([n,b])=>[n,digest(b)]))};
 manifest.assets['test/app.js']='f'.repeat(64);
 const raw=Buffer.from(JSON.stringify(manifest));files.set('production-release-manifest.json',raw);
 const read=async n=>{assert.ok(files.has(n),'unexpected file '+n);return files.get(n)};
 const copy=await captureRoot(read);assert.equal(copy.size,6);assert.ok(!copy.has('test/app.js'));
 const lock={frontendSha:'a'.repeat(40),backendSha:'b'.repeat(40)};
 assert.equal(await assertRootUnchanged({...lock,productionManifestSha256:digest(raw),rootAssets:6,productionAuthorized:false},lock,read),6);
 files.set('app.js',Buffer.from('changed'));await assert.rejects(captureRoot(read),/LIVE_ROOT_DIGEST_MISMATCH/);
 assert.throws(()=>rootInventory({...manifest,assets:{...manifest.assets,'../app.js':'a'.repeat(64)}}),/UNSAFE_PRODUCTION_INVENTORY_ENTRY/);
});
test('staging transport routes same-origin API and shared API into only the locked isolated QA',async()=>{
 const code=readFileSync(new URL('../test/staging-transport-20261111.js',import.meta.url),'utf8');
 const calls=[],window={fetch:async (input,init)=>{calls.push({url:input instanceof Request?input.url:input,method:init?.method||input?.method});return 'ok';}};
 const location=new URL('https://hakaru4i-afk.github.io/freight-quotes-web/test/');
 runInNewContext(code,{window,location,URL,Request,Promise,Error});
 const host='https://ibclzdkxiozbzmniiygv.supabase.co',prefix='/functions/v1/freight-api-qa-rc20261110';
 await window.fetch('/api/session',{method:'POST'});
 await window.fetch(host+'/functions/v1/freight-api/api/documents?id=1',{method:'POST'});
 assert.equal(new URL(calls[0].url).pathname,prefix+'/api/session');
 assert.equal(new URL(calls[1].url).pathname,prefix+'/api/documents');
 assert.equal(calls[1].method,'POST');assert.equal(new URL(calls[1].url).searchParams.get('forceFunctionRegion'),'eu-central-1');
 await assert.rejects(window.fetch(host+'/rest/v1/shipments'),/SHARED_STAGING_DATA_BLOCKED/);
 await assert.rejects(window.fetch(host+'/functions/v1/freight-api-qa-other/api/session'),/SHARED_STAGING_DATA_BLOCKED/);
 await assert.rejects(window.fetch('https://ooclsrndeygojtofuyte.supabase.co/functions/v1/freight-api/api/session'),/PRODUCTION_API_BLOCKED/);
 assert.equal(calls.length,2);
});

test('transient CDN failures retry and retain status diagnostics; persistent 404 never passes',async()=>{
 const calls=[];const bytes='expected';const result=await live('app.js',{fetcher:async url=>{calls.push(String(url));return new Response(calls.length<3?'unavailable':bytes,{status:calls.length<3?503:200})},delay:async()=>{},key:'123'});
 assert.equal(result.toString(),bytes);assert.equal(new Set(calls).size,1);assert.equal(calls.length,3);
 let count=0;await assert.rejects(live('process-history/old/P08.svg',{fetcher:async()=>{count++;return new Response('',{status:404})},delay:async()=>{}}),/P08.svg:HTTP_404/);assert.equal(count,3);
});
test('all missing and changed root files are diagnosed, never substituted',async()=>{
 const names=['index.html','app.js','style.css','build-info.json','site-status.json'],files=new Map(names.map(n=>[n,Buffer.from(n)]));
 const raw=Buffer.from(JSON.stringify({environment:'production',publicationState:'PUBLISHED',assets:Object.fromEntries([...files].map(([n,b])=>[n,digest(b)]))}));
 await assert.rejects(captureRoot(async n=>{if(n==='production-release-manifest.json')return raw;if(n==='app.js')throw Error('HTTP_404:app.js');if(n==='style.css')return Buffer.from('different');return files.get(n)}),e=>e.message.includes('HTTP_404:app.js')&&e.message.includes('LIVE_ROOT_DIGEST_MISMATCH:style.css'));
});

test('canonical active staging pair distinguishes historical API metadata and binds exact source/asset/deployment identities',async()=>{
 const {createStagingPair,stagingPairBytes}=await import('../scripts/release/locked-qa-runtime.mjs');
 const {qaProject,qaFunction}=await import('../scripts/release/locked-release.mjs');
 const lock={frontendSha:'a'.repeat(40),backendSha:'b'.repeat(40)},deployment={project:qaProject,function:qaFunction,id:'a'.repeat(8)+'-aaaa-aaaa-aaaa-'+'a'.repeat(12),version:54,bundle:'c'.repeat(64)};
 const v='SH-01.30.59 v',id='d'.repeat(20),json=x=>Buffer.from(JSON.stringify(x));
 const assets={'index.html':Buffer.from('index'),'app.js':Buffer.from('app'),'style.css':Buffer.from('css'),
  'build-info.json':json({environment:'staging',primaryBusinessVersion:v,stagingAssetBuildId:id,version:id,sharedStagingRuntime:{version:115}}),
  'staging-manifest.json':json({environment:'staging',primaryBusinessVersion:v,apiVersion:115}),
  'site-status.json':json({environment:'staging',version:id,release:{version:v}}),'release-status.json':json({version:v}),
  'staging-transport-20261111.js':Buffer.from('LOCKED_STAGING_ISOLATION_V1')};
 const pair=createStagingPair(lock,deployment,assets);
 assert.equal(pair.apiVersion,54);assert.equal(pair.backendSha,lock.backendSha);assert.equal(pair.frontendAssetBuild,id);
 assert.equal(pair.productionAuthorized,false);assert.equal(Object.keys(pair.assets).length,8);
 assert.notDeepEqual(stagingPairBytes(pair),stagingPairBytes(createStagingPair(lock,{...deployment,version:55},assets)));
 assert.throws(()=>createStagingPair(lock,{...deployment,project:'production'},assets),/STAGING_PAIR_DEPLOYMENT_INVALID/);
 assert.throws(()=>createStagingPair(lock,deployment,{...assets,'release-status.json':json({version:'SH-01.30.58 v'})}),/STAGING_VERSION_METADATA_MISMATCH/);
 assert.throws(()=>createStagingPair(lock,deployment,{...assets,'site-status.json':json({environment:'staging',version:'e'.repeat(20),release:{version:v}})}),/STAGING_VERSION_METADATA_MISMATCH/);
});
