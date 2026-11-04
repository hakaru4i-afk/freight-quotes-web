import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const manifest=JSON.parse(fs.readFileSync("test/build-info.json","utf8"));
async function get(path){const abort=AbortSignal.timeout(25000);const r=await fetch(base+path,{signal:abort,headers:{"Cache-Control":"no-cache"}});assert.equal(r.status,200,base+path+" failed "+r.status);return r.text();}
test("GitHub Pages actually serves exact staging build and assets",async()=>{
 let served,html,found=false;
 for(let attempt=0;attempt<12;attempt++){
   try{
     [served,html]=await Promise.all([get("build-info.json"),get("")]);
     const record=JSON.parse(served);
     if(record.build===manifest.build&&html.includes("./app.js?v="+manifest.servedAppBlobSha.slice(0,12))){
       found=true;break;
     }
   }catch(e){if(attempt===11)throw e;}
   await new Promise(r=>setTimeout(r,12000));
 }
 assert.ok(found,"Staging Pages serving old manifest or old JS after 144s; do not mark released");
 assert.match(html,/late-bid-staging\.js\?v=[a-f0-9]{12}/);
 assert.match(html,/task2-panel\.js\?v=[a-f0-9]{12}/);
 assert.ok(!html.includes("ooclsrndeygojtofuyte"),"Production Supabase must never be on staging page");
 const assets=[["app.js",manifest.servedAppBlobSha.slice(0,12)],["late-bid-staging.js",manifest.lateBidUiSha.slice(0,12)],["task2-panel.js",manifest.task2.frontendSha.slice(0,12)]];
 for(const [name,sha] of assets){
  const code=await get(name+"?v="+sha);
  assert.ok(code.length>300,"Staging asset unexpectedly empty "+name);
  if(name==="app.js") { assert.match(code,/freight-staging-ibclzdkxiozbzmniiygv-session/); assert.match(code,/functions\/v1\/freight-api"/);
  assert.doesNotMatch(code,/functions\/v1\/freight-api-qa-issue47qa/); assert.doesNotMatch(code,/ooclsrndeygojtofuyte/); }
  if(name==="late-bid-staging.js")assert.match(code,/api\/late-bid-drafts/);
 }
});
test("Staging Edge API responds without exposing protected data",async()=>{
 const baseApi="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api";
 const health=await fetch(baseApi+"/health",{signal:AbortSignal.timeout(15000)});
 assert.equal(health.status,200);
 const result=await health.json();
 assert.equal(result.projectRef,"ibclzdkxiozbzmniiygv");
 assert.equal(manifest.task2.backendFunction,"freight-api");
 assert.equal(manifest.task2.backendVersion,53);
 const unauth=await fetch(baseApi+"/api/late-bid-drafts",{signal:AbortSignal.timeout(15000)});
 assert.ok([401,403].includes(unauth.status),"Anonymous API data exposure: status "+unauth.status);
});
