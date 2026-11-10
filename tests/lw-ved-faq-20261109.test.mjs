import {createHash} from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const js=readFileSync(new URL("../test/current-workspace-help-20261108.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../test/index.html",import.meta.url),"utf8");

test("VED FAQ loads as valid JavaScript and uses a fresh staging asset",()=>{
 assert.doesNotThrow(()=>new Function(js));
 const blob=createHash("sha1").update(Buffer.from("blob "+Buffer.byteLength(js)+"\0")).update(js).digest("hex");
 assert.ok(html.includes("current-workspace-help-20261108.js?v="+blob.slice(0,12)));
});
test("VED identity is not misclassified as Certification",()=>{
 assert.match(js,/return "ved"/);
 assert.match(js,/if\(\/certificate\|certification\//);
 assert.doesNotMatch(js,/certificate\|certification\|ved\|вэд/);
 assert.match(js,/ved:\["ВЭД","Foreign trade","外贸"\]/);
});
test("FAQ has active pre-PTO VED document task, shared chat and assigned logistic requests",()=>{
 assert.match(js,/одна задача проверки документов/);
 assert.match(js,/below 1,000 km/);
 assert.match(js,/小于 1000 公里/);
 assert.match(js,/Чаты по заявкам/);
 assert.match(js,/назначенные вам документальные задания/);
 assert.doesNotMatch(js,/Автоматические задачи ВЭД исключены/);
 assert.doesNotMatch(js,/no VED tasks in the active process/);
 assert.doesNotMatch(js,/外贸任务已从当前流程移除/);
});
test("Transport application remains deferred in all three locales",()=>{
 assert.match(js,/Создание транспортной заявки отложено/);
 assert.match(js,/Transport-application drafting is deferred/);
 assert.match(js,/运输申请文件流程暂缓/);
});
