import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";

const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const scriptName="task2-panel-sidebar-only-20261107.js";
const script=read("test/"+scriptName);
const html=read("test/index.html");
const build=JSON.parse(read("test/build-info.json"));
const carrierDeferred=read("test/carrier-defer-transport-application-20261107.js");
const gitBlob=(s)=>createHash("sha1").update(Buffer.from("blob "+Buffer.byteLength(s)+"\0")).update(s).digest("hex");

test("deferred: no create/approval of transport application blocks execution for carrier",()=>{
 assert.match(script,/Исполнение перевозок/);
 assert.match(script,/Перевозка принята в работу/);
 assert.match(script,/started=!!d\.state/);
 assert.match(script,/Ожидается принятие перевозки/);
 assert.doesNotMatch(script,/d\.booking_state!=="approved"|else if\(d\.booking_state/);
 assert.doesNotMatch(script,/Исполнение и трекинг откроются после согласования/);
 assert.match(carrierDeferred,/location\.replace/);
 assert.match(carrierDeferred,/approved-shipments/);
 assert.match(carrierDeferred,/carrier-portal/);
});
test("one left sidebar and current six-section execution, no unapproved claims tab",()=>{
 assert.doesNotMatch(script,/const workflowNav=|t2-workflow-nav|t2-workflow-link/);
 assert.match(script,/No secondary menu/);
 for(const [key,name] of [["overview","1. Общая информация"],["track","2. Трекинг"],["documents","3. Документы"],["stages","Этапы перевозки"],["completion","Завершение"],["history","История"]]){
  assert.ok(script.includes('["'+key+'","'+name+'"]'),key);
 }
 assert.match(script,/data-section="approved-shipments"/);
 assert.match(script,/if\(false && state\.tab==="claims"\)/,"Unapproved claims editor remains hidden");
 assert.match(script,/Статус исполнения/);
});
test("original transport application source and evidence are retained for later backlog",()=>{
 const old=read("test/transport-application-editor.mjs");
 assert.ok(old.length>1000,"source preserved for future Issue 28 work");
 assert.ok(html.includes("./carrier-defer-transport-application-20261107.js"),"defer guard remains loaded");
});
test("served staging URL references pinned execution script and current API",()=>{
 assert.equal(build.task2.frontendScript,scriptName);
 assert.equal(build.task2.frontendSha,gitBlob(script));
 assert.ok(html.includes(scriptName+"?v="+gitBlob(script).slice(0,12)));
 assert.ok(build.task2.backendVersion>=84);
 assert.match(build.task2.backendDeploymentStatus,new RegExp(`SHARED_STAGING_API_V${build.task2.backendVersion}_ACTIVE`));
 assert.doesNotMatch(html,/ooclsrndeygojtofuyte/);
});
