import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
// PRs verify the deployed baseline; post-publish checks verify the candidate.
const expectedDir=resolve(process.env.QA_SERVED_EXPECTED_DIR||'.','test');
const local=name=>fs.readFileSync(resolve(expectedDir,name));
const manifest=JSON.parse(local('build-info.json'));
const base='https://hakaru4i-afk.github.io/freight-quotes-web/test/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function get(name){
 const response=await fetch(base+name,{signal:AbortSignal.timeout(25000),headers:{'Cache-Control':'no-cache'}});
 assert.equal(response.status,200,name+' unavailable');
 return Buffer.from(await response.arrayBuffer());
}
test('GitHub Pages serves exact baseline or post-publication candidate bytes',async()=>{
 const names=['index.html','build-info.json','app.js',manifest.lateBidUiScript,manifest.task2.frontendScript,manifest.task2.guidanceScript];
 for(const name of names){
  assert.equal(hash(await get(name)),hash(local(name)),'Published staging differs: '+name);
 }
 const html=local('index.html').toString();
 assert.doesNotMatch(html,/ooclsrndeygojtofuyte/);
 const app=local('app.js').toString();
 assert.match(app,/freight-staging-ibclzdkxiozbzmniiygv-session/);
 assert.match(app,/functions\/v1\/freight-api"/);
 assert.doesNotMatch(app,/functions\/v1\/freight-api-qa-issue47qa|ooclsrndeygojtofuyte/);
 assert.match(local(manifest.lateBidUiScript).toString(),/api\/late-bid-drafts/);
});
test('Staging API health and anonymous denial are independently verified',async()=>{
 const api='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api';
 const health=await fetch(api+'/health',{signal:AbortSignal.timeout(15000)});
 assert.equal(health.status,200);
 const result=await health.json();
 assert.equal(result.projectRef,'ibclzdkxiozbzmniiygv');
 assert.equal(result.environment,'staging');
 assert.equal(result.build,manifest.task2.backendBuild);
 assert.equal(manifest.task2.backendFunction,'freight-api');
 assert.equal(manifest.task2.backendVersion,manifest.task2.lastObservedBackendVersion);
 const unauth=await fetch(api+'/api/late-bid-drafts',{signal:AbortSignal.timeout(15000)});
 assert.ok([401,403].includes(unauth.status),'Anonymous API data exposure');
});
