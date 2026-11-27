import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../portal-release-status-20261117.js',import.meta.url),'utf8');
const version=n=>'SH-01.30.'+String(n).padStart(2,'0')+' v';
const hash='a'.repeat(20),fe='b'.repeat(40),be='c'.repeat(40),api='freight-api-release-'+'d'.repeat(32);
function metadata(n){
 const v=version(n);
 return {status:{version:v,status:'released',ownerVersion:'OW-01.30.52 v',changes:[]},
 build:{environment:'production',releaseStatus:'PUBLISHED',releaseVersion:v,build:hash,frontendSourceCommit:fe,backendSourceCommit:be,apiFunction:api},
 receipt:{environment:'production',publicationState:'PUBLISHED',businessVersion:v,frontendBuild:hash,frontendSourceCommit:fe,backendSourceCommit:be,apiFunction:api}};
}
async function render(loaded,meta){
 const root={hidden:true,innerHTML:'',dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(){}};
 const document={currentScript:{src:'https://example.com/freight-quotes-web/portal-release-status-20261117.js?v='+encodeURIComponent(loaded)},documentElement:{lang:'ru'},readyState:'complete',body:{append(){}},createElement(){return root},querySelector(){return true},addEventListener(){}};
 const fetch=async url=>{const path=new URL(url).pathname;const body=path.endsWith('/release-status.json')?meta.status:path.endsWith('/build-info.json')?meta.build:meta.receipt;return {ok:true,json:async()=>body};};
 vm.runInNewContext(source,{window:{},document,URL,fetch,MutationObserver:class{observe(){}},setInterval(){},requestAnimationFrame(){},location:{reload(){throw Error('unexpected reload')}}});
 await new Promise(resolve=>setImmediate(resolve));
 return root;
}
test('older complete metadata never offers a downgrade',async()=>{
 const r=await render(version(75),metadata(74));
 assert.match(r.innerHTML,/Сведения о версии проверяются/);
 assert.doesNotMatch(r.innerHTML,/Доступна новая версия|data-release-reload/);
 assert.match(r.innerHTML,/SH-01\.30\.75 v/);
});
test('only a newer, mutually verified publication offers reload',async()=>{
 const r=await render(version(74),metadata(75));
 assert.match(r.innerHTML,/Доступна новая версия/);
 assert.match(r.innerHTML,/data-release-reload/);
});
test('identical published version hides notification',async()=>{
 const r=await render(version(75),metadata(75));
 assert.equal(r.hidden,true);
 assert.equal(r.innerHTML,'');
});
test('stale status and mismatched build or receipt do not offer reload',async()=>{
 for(const mismatch of ['status','build','sha','receipt','invalid']){
  const m=metadata(76);
  if(mismatch==='status')m.status.version=version(74);
  if(mismatch==='build')m.build.releaseVersion=version(75);
  if(mismatch==='sha')m.build.backendSourceCommit='e'.repeat(40);
  if(mismatch==='receipt')m.receipt.publicationState='CHECKING';
  if(mismatch==='invalid')m.status.version='unexpected';
  const r=await render(version(75),m);
  assert.match(r.innerHTML,/Сведения о версии проверяются/);
  assert.doesNotMatch(r.innerHTML,/data-release-reload/);
 }
});
test('in-progress version is not a published upgrade',async()=>{
 const m=metadata(75);m.status.version=version(76);m.status.status='updating';
 const r=await render(version(75),m);
 assert.match(r.innerHTML,/Идёт обновление портала/);
 assert.doesNotMatch(r.innerHTML,/data-release-reload/);
});
