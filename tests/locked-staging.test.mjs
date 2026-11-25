import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {captureRoot,assertRootUnchanged,rootInventory} from '../scripts/release/locked-staging.mjs';
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
