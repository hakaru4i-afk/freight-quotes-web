import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const html=readFileSync("test/index.html","utf8");
const manifest=JSON.parse(readFileSync("test/build-info.json","utf8"));
const scripts=[
 ["app.js",manifest.servedAppBlobSha],
 ["late-bid-staging.js",manifest.lateBidUiSha],
 ["task2-panel.js",manifest.task2.frontendSha],
 ["task2-guidance.js",manifest.task2.guidanceSha]
];
test("staging HTML resolves exact committed JS blob versions",()=>{
 for(const [name,expected] of scripts){
   assert.match(expected,/^[a-f0-9]{40}$/);
   const blob=readFileSync("test/"+name);
   const actual=createHash("sha1").update("blob "+blob.length+"\0").update(blob).digest("hex");
   assert.equal(actual,expected,name+" source hash mismatch");
   assert.ok(html.includes('./'+name+'?v='+expected.slice(0,12)),name+" cache key stale");
 }
});
test("staging app uses isolated backend and never masquerades as complete",()=>{
 assert.equal(manifest.environment,"staging");
 assert.equal(manifest.projectRef,"ibclzdkxiozbzmniiygv");
 assert.ok(manifest.task2.backendVersion>=52);
 assert.equal(manifest.task2Complete,false);
 assert.equal(manifest.task2.fullTaskCompleted,false);
 assert.equal(manifest.task2.manualAcceptance,"PENDING");
 assert.ok(!readFileSync("index.html","utf8").includes("task2-guidance.js"));
});
