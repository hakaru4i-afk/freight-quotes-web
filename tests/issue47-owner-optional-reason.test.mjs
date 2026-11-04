import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const s=fs.readFileSync("test/app.js","utf8");
const html=fs.readFileSync("test/index.html","utf8");
const info=JSON.parse(fs.readFileSync("test/build-info.json","utf8"));
const start=s.indexOf("function Ny({bid:i,approval:c,selection:h,onChanged:m})");
const end=s.indexOf("Xe.unshift(",start);
const scope=s.slice(start,end);
const ru=t=>[...t].map(ch=>ch.charCodeAt(0)>127?"\\u"+ch.charCodeAt(0).toString(16).toUpperCase().padStart(4,"0"):ch).join("");
test("owner explanation optional but explicit selected bid remains required",()=>{
assert.ok(start>=0&&end>start);
assert.ok(scope.includes(ru("Обоснование выбора (необязательно)")));
assert.ok(!scope.includes('r("textarea",{required:!0,minLength:10'));
assert.ok(scope.includes('"/api/offer-selection"'));
assert.ok(scope.includes("bidId:i.id"));
});
test("staging QA candidate cache bust matches app and reports actual isolated API",()=>{
assert.equal(info.environment,"staging");
assert.equal(info.task2Complete,false);
assert.equal(info.task2.lastObservedBackendVersion,53);
assert.equal(info.task2.backendVersion,53);
assert.equal(info.task2.backendDeploymentStatus,"SHARED_STAGING_API_V53_ACTIVE; FULL_ACCEPTANCE_PENDING");
assert.equal(info.task2.backendFunction,"freight-api");
assert.match(s,/functions\/v1\/freight-api"/);
assert.doesNotMatch(s,/functions\/v1\/freight-api-qa-issue47qa/);
assert.match(info.task2.backendCandidate.sha256,/^[a-f0-9]{64}$/);
assert.ok(html.includes("./app.js?v="+info.servedAppBlobSha.slice(0,12)));
});
