import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const stageAPI="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api";
const fileNames=["index.html","build-info.json","app.js","task2-panel-260ba5a1c29f.js","task2-guidance-42dc6ccc8a20.js","task2-i18n.js","late-bid-staging-3ff2c9ab03f5.js","task2.css","transport-application-model.mjs","transport-application-editor.mjs","transport-application.css"];
function githubBlob(buf){return createHash("sha1").update(Buffer.from("blob "+buf.length+"\0")).update(buf).digest("hex");}
async function load(url){
 const res=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{"Cache-Control":"no-cache","Pragma":"no-cache"}});
 if(!res.ok)throw new Error(url+" returned HTTP "+res.status);
 return Buffer.from(await res.arrayBuffer());
}
async function retry(action){
 let error;
 for(let i=0;i<8;i++){
  try{return await action();}
  catch(e){error=e;console.log("Published-site attempt "+(i+1)+"/8: "+e.message);if(i<7)await new Promise(r=>setTimeout(r,7000));}
 }
 throw error;
}
test("GitHub Pages serves the EXACT current staging files",async()=>{
 await retry(async()=>{
  const published=new Map();
  for(const name of new Set([...fileNames,...(JSON.parse(readFileSync("test/build-info.json","utf8")).carrierDocument?.moduleAssets||[])])){
   const content=await load(root+name+"?issue47_qa="+Date.now());
   const local=readFileSync("test/"+name);
   assert.equal(githubBlob(content),githubBlob(local),name+" served SHA differs from repository");
   published.set(name,content.toString("utf8"));
  }
  const manifest=JSON.parse(published.get("build-info.json")),html=published.get("index.html");
  assert.equal(manifest.environment,"staging");
  assert.equal(manifest.projectRef,"ibclzdkxiozbzmniiygv");
  assert.equal(manifest.servedAppBlobSha,githubBlob(readFileSync("test/app.js")));
  assert.equal(manifest.task2.frontendSha,githubBlob(readFileSync("test/"+manifest.task2.frontendScript)));
  assert.equal(manifest.task2.guidanceSha,githubBlob(readFileSync("test/"+manifest.task2.guidanceScript)));
  for(const [name,sha] of [
    ["app.js",manifest.servedAppBlobSha],
    [manifest.task2.frontendScript,manifest.task2.frontendSha],
    [manifest.task2.guidanceScript,manifest.task2.guidanceSha]
  ]) assert.ok(html.includes(name+"?v="+sha.slice(0,12)),"HTML cache key out of sync: "+name);
  assert.equal(manifest.task2.i18n.sourceSha,githubBlob(readFileSync("test/task2-i18n.js")));
  assert.ok(html.includes("task2-i18n.js?v="+manifest.task2.i18n.sourceSha.slice(0,12)));
  assert.equal(manifest.task2Complete,false,"Do not falsely mark unfinished E2E as PASS");
  assert.equal(manifest.task2.backendFunction,"freight-api");
  assert.equal(manifest.task2.backendVersion,manifest.carrierOutcomeFix.backendVersion);
  console.log("PASS: exact GitHub Pages staging bytes and manifest verified");
 });
},{timeout:135000});
test("Staging API responds and denies anonymous protected actions",async()=>{
 const health=await fetch(stageAPI+"/health",{signal:AbortSignal.timeout(20000)});
 assert.equal(health.status,200);
 const h=await health.json();
 assert.equal(h.projectRef,"ibclzdkxiozbzmniiygv");
 assert.equal(h.build,JSON.parse(readFileSync("test/build-info.json","utf8")).task2.backendBuild);
 for(const route of ["/api/late-bid-drafts","/api/task2"]){
  const resp=await fetch(stageAPI+route,{signal:AbortSignal.timeout(20000)});
  assert.ok([401,403].includes(resp.status),"Anonymous "+route+" returned "+resp.status);
 }
 console.log("PASS: isolated API and protected endpoints");
},{timeout:70000});
