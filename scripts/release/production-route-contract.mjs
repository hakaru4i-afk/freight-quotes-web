import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {targetFunction,readLock,digest} from './locked-release.mjs';
const root=resolve(process.argv[2]||'.');
const mode=process.argv[3]||'source';
const app=readFileSync(resolve(root,'app.js'),'utf8');
const modulePath=resolve(root,'staging-api-region.mjs');
const transportPath=resolve(root,'staging-transport-20261111.js');
const {stagingRegionalUrl}=await import(pathToFileURL(modulePath).href);
assert.match(app,/import\s*\{\s*stagingRegionalUrl\s*\}\s*from\s*["']\.\/staging-api-region\.mjs\?v=[a-f0-9]{12,40}["']/);
assert.ok(app.includes('stagingRegionalUrl('),'ACTUAL_APP_REGION_CALL_REQUIRED');
const slug=mode==='package'?JSON.parse(readFileSync(resolve(root,'production-release-manifest.json'),'utf8')).apiFunction:targetFunction(readLock());
assert.match(slug,/^freight-api-release-[a-f0-9]{32}$/);
const base='https://ooclsrndeygojtofuyte.supabase.co/functions/v1/';
const calls=[];
const window={fetch:(...args)=>{calls.push(args);return Promise.resolve(new Response(null,{status:204}))}};
vm.runInNewContext(readFileSync(transportPath,'utf8'),{window,Request,URL,location:{href:'https://hakaru4i-afk.github.io/freight-quotes-web/'}});
for(const name of ['freight-api',slug])for(const route of ['session','data','auth','chats']){
 const url=base+name+'/api/'+route+'?fixture=1';
 const routed=stagingRegionalUrl(url);
 const parsed=new URL(routed);
 assert.equal(parsed.pathname,new URL(url).pathname);
 assert.equal(parsed.searchParams.get('fixture'),'1');
 assert.equal(parsed.searchParams.get('forceFunctionRegion'),'eu-central-1');
 await window.fetch(routed);
 assert.equal(calls.at(-1)[0],routed);
}
assert.equal(calls.length,8);
for(const url of [base+'freight-api-release-invalid/api/session','https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/session','https://example.com/functions/v1/'+slug+'/api/session'])assert.throws(()=>stagingRegionalUrl(url));
if(mode==='package'){
 assert.ok(app.includes(base+slug+'"'),'PACKAGED_APP_API_MISMATCH');
 assert.ok(app.includes('staging-api-region.mjs?v='+digest(readFileSync(modulePath)).slice(0,20)),'PACKAGED_MODULE_CACHE_MISMATCH');
 assert.ok(readFileSync(resolve(root,'index.html'),'utf8').includes('staging-transport-20261111.js?v='+digest(readFileSync(transportPath)).slice(0,20)),'PACKAGED_WRAPPER_CACHE_MISMATCH');
}
console.log('PRODUCTION_ROUTE_CONTRACT_PASS '+mode+' '+slug);
