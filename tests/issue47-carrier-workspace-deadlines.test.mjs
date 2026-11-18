import {assertProductionFeatureBoundary} from './helpers/production-release-boundary.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync("test/app.js", "utf8");
const css = readFileSync("test/style.css", "utf8");
const html = readFileSync("test/index.html", "utf8");
const manifest = JSON.parse(readFileSync("test/build-info.json", "utf8"));
const production = readFileSync("app.js", "utf8");
const start = app.indexOf("function issue47Stage(n,b)");
const end = app.indexOf("function S0(", start);
assert.ok(start >= 0 && end > start, "carrier workspace helpers exist");
const api = vm.runInNewContext(app.slice(start, end) + ";({stage:issue47Stage,label:issue47StageLabel,time:issue47MinskTime,deadline:issue47CarrierDeadline,tasks:issue47CarrierDeadlines})", { Date, Number, String });

function note(overrides = {}) {
  return {order_code:"12", round_id:"round-12", is_current:1, workflow_status:"new", deadline:"2026-11-10T17:00", ...overrides};
}
test("terminal decision outweighs interim bid acceptance", () => {
  const bids=[{order_code:"12",round_id:"round-12",decision:"accepted",amount:4500}];
  assert.equal(api.stage(note({round_result:"lost"}),bids),"archive");
  assert.equal(api.label(note({round_result:"lost"}),bids),"Не выбран · архив");
  assert.equal(api.stage(note({selected_offer:{bid_id:"bid-42"}}),bids),"selected");
  assert.equal(api.label(note({selected_offer:{bid_id:"bid-42"}}),bids),"Выиграна");
  assert.equal(api.stage(note({}),bids),"review");
  assert.equal(api.stage(note({workflow_status:"accepted"}),[]),"preparing");
  assert.equal(api.stage(note({completion_state:"completed",selected_offer:{}}),[]),"completed");
});
test("server-viewed requests keep their bid deadline and authoritative stage",()=>{
 const row=note({dashboard_stage:"viewed",workflow_status:"new"});
 assert.equal(api.stage(row,[]),"viewed");assert.equal(api.label(row,[]),"Просмотрена");
 assert.equal(api.tasks([row],[]).length,1);assert.equal(api.tasks([row],[])[0].kind,"bid");
 assert.equal(api.label(note({dashboard_stage:"lost"}),[]),"Не выбран · архив");
 assert.match(api.deadline(note({dashboard_stage:"selected"})),/Приём закрыт/);
});
test("deadline is Minsk time and archived deadlines are historical", () => {
  assert.equal(api.time("2026-11-04T17:00"), Date.UTC(2026,10,4,14,0));
  assert.match(api.deadline(note({round_result:"lost",deadline:"2026-11-04T17:00"})),/Приём закрыт/);
  assert.match(api.deadline(note({deadline:""})),/не установлен/);
});
test("dashboard filters closed requests, picks real dates, sorts overdue first", () => {
  const entries = [
   note({order_code:"archived",round_id:"r0",round_result:"lost",deadline:"2026-11-02T17:00"}),
   note({order_code:"later",round_id:"r1",deadline:"2026-11-12T17:00"}),
   note({order_code:"sooner",round_id:"r2",deadline:"2026-11-06T17:00"}),
   note({order_code:"selected",round_id:"r3",selected_offer:{bid_id:"x"},deadline:"2026-11-01T17:00"})
  ];
  const own=[{round_id:"r3",order_code:"selected",selected_offer:{bid_id:"x"},pickup:"11.11.2026"}];
  const tasks=api.tasks(entries,own);
  assert.ok(!tasks.some(x=>x.order_code==="archived"));
  assert.deepEqual(Array.from(tasks.map(x=>x.order_code)),["sooner","selected","later"]);
  assert.match(tasks[1].description,/забор/i);
});
test("carrier assets stay isolated until a verified production promotion", () => {
  for(const tab of ["Новые","Просмотрены","Расчёт ставки","На рассмотрении","Выиграны","В пути","Требуют ответа","Отказался","Не выбрали","Завершены","Архив"])assert.ok(app.includes(tab));
  for(const marker of ['className:"carrier-card-deadline"','className:"carrier-card-subline"','className:"carrier-card-stage"','issue124CarrierMatches(x,dashboard,d,b)','Ближайшие сроки и действия'])assert.ok(app.includes(marker), marker);
  assert.match(css,/STAGING Issue #47 \/ B10-B11/);
  assert.equal(manifest.carrierWorkspace.status,"COMMITTED_STAGING_QA_PENDING");
  assert.ok(html.includes("app.js?v="+manifest.servedAppBlobSha.slice(0,12)));
  assert.ok(html.includes("style.css?v="+manifest.servedStyleBlobSha.slice(0,12)));
 assertProductionFeatureBoundary(production,'issue47CarrierDeadlines');
});
