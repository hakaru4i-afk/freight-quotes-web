import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
// PRs verify the deployed baseline; post-publish checks verify the candidate.
const expectedDir=resolve(process.env.QA_SERVED_EXPECTED_DIR||'.','test');
const local=name=>fs.readFileSync(resolve(expectedDir,name));
const manifest=JSON.parse(local('build-info.json'));
// API advances independently while a PR still verifies exact deployed frontend bytes.
const apiManifest=JSON.parse(fs.readFileSync(resolve('test/build-info.json')));
const base='https://hakaru4i-afk.github.io/freight-quotes-web/test/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function get(name){
 const response=await fetch(base+name,{signal:AbortSignal.timeout(25000),headers:{'Cache-Control':'no-cache'}});
 assert.equal(response.status,200,name+' unavailable');
 return Buffer.from(await response.arrayBuffer());
}
test('GitHub Pages serves an attested staging baseline independently of the unpublished PR',async()=>{
 const served=JSON.parse((await get('build-info.json')).toString('utf8'));
 assert.equal(served.projectRef,'ibclzdkxiozbzmniiygv');
 assert.equal(served.environment,'staging');
 const names=['index.html','app.js',served.lateBidUiScript,served.task2.frontendScript,served.task2.guidanceScript];
 const files={};
 for(const name of names){
  const value=await get(name);files[name]=value;
  if(process.env.QA_SERVED_EXPECTED_DIR){
   assert.equal(hash(value),hash(local(name)),'Published file differs from attested deployment: '+name);
  }else if(served.currentAssetSha256?.[name]){
   assert.equal(hash(value),served.currentAssetSha256[name],'Published file digest differs from deployed manifest: '+name);
  }
 }
 const sha1=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0')).update(bytes).digest('hex');
 // The deployed build-info and the bytes actually served must agree, regardless
 // of the independent release candidate currently under test.
 assert.equal(sha1(files['app.js']),served.servedAppBlobSha);
 assert.equal(sha1(files[served.task2.frontendScript]),served.task2.frontendSha);
 assert.equal(sha1(files[served.task2.guidanceScript]),served.task2.guidanceSha);
 const html=files['index.html'].toString(),app=files['app.js'].toString();
 assert.ok(html.includes('app.js?v='+served.servedAppBlobSha.slice(0,12)),'Published JS cache key not source-attested');
 assert.doesNotMatch(html,/ooclsrndeygojtofuyte/);
 assert.match(app,/freight-staging-ibclzdkxiozbzmniiygv-session/);
 assert.match(app,/functions\\/v1\\/freight-api"/);
 assert.doesNotMatch(app,/functions\\/v1\\/freight-api-qa-issue47qa|ooclsrndeygojtofuyte/);
 assert.match(files[served.lateBidUiScript].toString(),/api\\/late-bid-drafts/);
 // Independently fail if an unpublished candidate's own manifest is stale.
 assert.equal(manifest.servedAppBlobSha,sha1(local('app.js')),'Candidate build and app differ');
 assert.ok(local('index.html').toString().includes('app.js?v='+manifest.servedAppBlobSha.slice(0,12)),'Candidate cache key stale');
});
test('Staging API health and anonymous denial are independently verified',async()=>{
 const api='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api';
 const health=await fetch(api+'/health',{signal:AbortSignal.timeout(15000)});
 assert.equal(health.status,200);
 const result=await health.json();
 assert.equal(result.projectRef,'ibclzdkxiozbzmniiygv');
 assert.equal(result.environment,'staging');
 const served=JSON.parse((await get('build-info.json')).toString('utf8'));
 assert.equal(result.build,served.task2.backendBuild,'Staging API does not match currently published staging source');
 assert.equal(apiManifest.task2.backendFunction,'freight-api');
 assert.equal(apiManifest.task2.backendVersion,apiManifest.task2.lastObservedBackendVersion);
 const unauth=await fetch(api+'/api/late-bid-drafts',{signal:AbortSignal.timeout(15000)});
 assert.ok([401,403].includes(unauth.status),'Anonymous API data exposure');
});
