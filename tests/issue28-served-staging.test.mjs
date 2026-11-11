import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {createHash} from "node:crypto";

const localRoot=pathToFileURL(resolve(process.env.QA_SERVED_EXPECTED_DIR||".","test")+"/");
const base="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const read=path=>readFileSync(new URL(path,localRoot));
const blob=data=>createHash("sha1").update(Buffer.from("blob "+data.length+"\0")).update(data).digest("hex");
const expected=JSON.parse(read("build-info.json").toString("utf8"));
async function serve(path){
  const result=await fetch(base+path+"?verify_issue28="+Date.now(),{headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(20000)});
  assert.equal(result.status,200,"GitHub Pages status "+result.status+" for "+path);
  return Buffer.from(await result.arrayBuffer());
}
async function retry(fn){
  let last;
  for(let i=0;i<10;i++){
    try{return await fn()}catch(e){last=e; if(i<9)await new Promise(r=>setTimeout(r,6000))}
  }
  throw last;
}
test("GitHub Pages serves document-only staging baseline or candidate byte-for-byte",async()=>{
  assert.equal(expected.environment,"staging");
  assert.equal(expected.projectRef,"ibclzdkxiozbzmniiygv");
  if(expected.primaryBusinessVersion){assert.equal(expected.releaseVersion,'SH-01.30.50 v');assert.equal(expected.version,expected.stagingAssetBuildId);assert.match(expected.legacyVersionLabels.releaseVersion,/^\d+\.\d+\.\d+$/);}else{assert.ok(process.env.QA_SERVED_EXPECTED_DIR,'Legacy metadata is allowed only for explicit deployed baseline');assert.match(expected.releaseVersion,/^\d+\.\d+\.\d+$/);}
  await retry(async()=>{
    const [build,html,app]=await Promise.all([serve("build-info.json"),serve("index.html"),serve("app.js")]);
    const active=JSON.parse(build.toString("utf8"));
    assert.equal(active.releaseVersion,expected.releaseVersion,"Pages release differs from expected deployment");
    assert.equal(active.projectRef,expected.projectRef);
    assert.equal(blob(app),blob(read("app.js")),"Published application bytes are outdated");
    assert.equal(blob(app),expected.servedAppBlobSha,"Manifest and bundle differ");
    assert.equal(blob(html),blob(read("index.html")),"Published staging HTML is outdated");
    assert.ok(html.toString("utf8").includes("./app.js?v="+blob(app).slice(0,12)),"App cache key outdated");
    assert.equal(active.issue28.documentOnly,true);
    assert.equal(active.issue28.postAwardDocumentStatusFix,true);
  });
},{timeout:150000});
