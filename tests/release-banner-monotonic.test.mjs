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

test('staging banner refuses stale or divergent metadata and preserves separate notices',async()=>{
 const stageSource=readFileSync(new URL('../test/portal-release-status-20261117.js',import.meta.url),'utf8');
 const project='ibclzdkxiozbzmniiygv',api='freight-api-qa-rc20261110',id=project+'_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa_54',key='f'.repeat(12);
 const meta=n=>{const v=version(n);return {status:{version:v,status:'released',changes:[]},
  build:{environment:'staging',primaryBusinessVersion:v,version:hash,stagingAssetBuildId:hash,servedAppBlobSha:'f'.repeat(40)},
  stage:{environment:'staging',primaryBusinessVersion:v},receipt:{schemaVersion:1,environment:'staging',productionAuthorized:false,frontendSha:fe,backendSha:be,frontendAssetBuild:hash,sourceBusinessVersion:v,apiProject:project,apiFunction:api,apiVersion:54,apiDeploymentId:id,apiBundleSha256:'a'.repeat(64)},
  health:{ok:true,environment:'staging',projectRef:project,qaRun:'rc20261110',backendSha:be,deploymentId:id}};};
 async function renderStage(m,loaded='',appKey=key){
  const roots=[];const make=()=>({hidden:true,innerHTML:'',dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},replaceChildren(){this.innerHTML=''}});
  const document={currentScript:{src:'https://example.com/freight-quotes-web/test/portal-release-status-20261117.js?v='+encodeURIComponent(loaded||'hash')},documentElement:{lang:'ru'},readyState:'complete',body:{append(...x){roots.push(...x)}},createElement:make,querySelector(s){return s.startsWith('script[')?{src:'https://example.com/freight-quotes-web/test/app.js?v='+appKey}:true},addEventListener(){}};
  const fetch=async url=>{const path=new URL(url,'https://example.com').pathname;const body=path.endsWith('/release-status.json')?m.status:path.endsWith('/build-info.json')?m.build:path.endsWith('/staging-manifest.json')?m.stage:path.endsWith('/active-runtime-pair.json')?m.receipt:path.endsWith('/health')?m.health:{ok:true,items:[]};return {ok:true,json:async()=>body};};
  vm.runInNewContext(stageSource,{window:{},document,URL,fetch,MutationObserver:class{observe(){}},setInterval(){},requestAnimationFrame(){},location:{reload(){throw Error('unexpected reload')}}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(roots.length,2);return roots[0];
 }
 assert.equal((await renderStage(meta(75))).hidden,true);
 const old=await renderStage(meta(74),version(75));assert.match(old.innerHTML,/Сведения о тестовой версии проверяются/);assert.doesNotMatch(old.innerHTML,/data-release-reload/);
 const newer=await renderStage(meta(76),version(75),'e'.repeat(12));assert.match(newer.innerHTML,/data-release-reload/);
 for(const m of [meta(75),meta(75),meta(75)].map((m,i)=>{if(i===0)m.health.backendSha=fe;if(i===1)m.receipt.apiVersion=55;if(i===2)m.stage.primaryBusinessVersion=version(74);return m;})){
  const r=await renderStage(m);assert.match(r.innerHTML,/Сведения о тестовой версии проверяются/);assert.doesNotMatch(r.innerHTML,/data-release-reload/);
 }
 const unknown=await renderStage(meta(76),'','e'.repeat(12));assert.match(unknown.innerHTML,/Сведения о тестовой версии проверяются/);assert.doesNotMatch(unknown.innerHTML,/data-release-reload/);
});
