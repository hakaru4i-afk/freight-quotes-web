import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
const expectedDir=resolve(process.env.QA_SERVED_EXPECTED_DIR||".","test");
const read=name=>readFileSync(resolve(expectedDir,name));
const root="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const stageAPI="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api";
const fileNames=["index.html","build-info.json","app.js","task2-panel-sidebar-only-20261107.js","task2-process-split-20261107.css","issue28-document-navigation-20261107.js","task2-guidance-42dc6ccc8a20.js","task2-i18n.js","late-bid-staging-3ff2c9ab03f5.js","task2.css","transport-application-model.mjs","transport-application-editor.mjs","transport-application.css"];
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
test("GitHub Pages serves byte-verified staging release, independently from an unpublished PR",async()=>{
 await retry(async()=>{
  const buildBytes=await load(root+"build-info.json?issue47_qa="+Date.now());
  const manifest=JSON.parse(buildBytes.toString("utf8"));
  assert.equal(manifest.environment,"staging");
  assert.equal(manifest.projectRef,"ibclzdkxiozbzmniiygv");
  const published=new Map([["build-info.json",buildBytes.toString("utf8")]]);
  const names=new Set([...fileNames,...(manifest.carrierDocument?.moduleAssets||[])]);
  for(const name of names){
   if(name==="build-info.json")continue;
   const content=await load(root+name+"?issue47_qa="+Date.now());
   // An explicit immutable post-publication baseline uses byte-for-byte
   // comparison. A pull-request candidate is *not* an already deployed site:
   // compare served files with the served manifest's own cryptographic digests.
   if(process.env.QA_SERVED_EXPECTED_DIR){
    assert.equal(githubBlob(content),githubBlob(read(name)),name+" differs from attested published baseline");
   }else{
    const sha256=manifest.currentAssetSha256?.[name];
    if(sha256)assert.equal(createHash("sha256").update(content).digest("hex"),sha256,"Published manifest digest mismatch: "+name);
   }
   published.set(name,content.toString("utf8"));
  }
  const html=published.get("index.html"),app=published.get("app.js");
  assert.equal(manifest.servedAppBlobSha,githubBlob(Buffer.from(app)),"Published app differs from its manifest");
  assert.ok(html.includes("./app.js?v="+manifest.servedAppBlobSha.slice(0,12)),"Published HTML cache key differs from app digest");
  // Local candidate must pass its own independent cryptographic checks;
  // PR validation must never certify unshipped files as already published.
  const candidate=JSON.parse(read("build-info.json").toString("utf8"));
  assert.equal(candidate.servedAppBlobSha,githubBlob(read("app.js")),"PR candidate app/manifest mismatch");
  assert.ok(read("index.html").toString("utf8").includes("app.js?v="+candidate.servedAppBlobSha.slice(0,12)),"PR candidate cache key differs from its app");
  assert.equal(manifest.task2Complete,false,"Do not falsely mark unfinished E2E as PASS");
  assert.equal(manifest.task2.backendFunction,"freight-api");
  assert.equal(manifest.task2.backendVersion,manifest.task2.lastObservedBackendVersion);
  console.log("PASS: live staging release digests and local PR candidate verified independently");
 });
},{timeout:135000});
test("Staging API responds and denies anonymous protected actions",async()=>{
 const health=await fetch(stageAPI+"/health",{signal:AbortSignal.timeout(20000)});
 assert.equal(health.status,200);
 const h=await health.json();
 assert.equal(h.projectRef,"ibclzdkxiozbzmniiygv");
 const served=await load(root+"build-info.json?issue47_api="+Date.now());
 const deployed=JSON.parse(served.toString("utf8"));
 assert.equal(deployed.releaseVersion,deployed.primaryBusinessVersion,"Deployed staging business version must be internally consistent");
 assert.equal(h.build,deployed.primaryBusinessVersion,"Live staging API business release differs from deployed primary business version");
 // task2.backendBuild is the historical Task 2 build, not the API health business label; backendVersion remains checked below.
 // A candidate build is separate and must pass canonical source/compatibility QA.
 for(const route of ["/api/late-bid-drafts","/api/task2"]){
  const resp=await fetch(stageAPI+route,{signal:AbortSignal.timeout(20000)});
  assert.ok([401,403].includes(resp.status),"Anonymous "+route+" returned "+resp.status);
 }
 console.log("PASS: isolated API and protected endpoints");
},{timeout:70000});
