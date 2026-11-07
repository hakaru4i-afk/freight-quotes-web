import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";

const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const scriptName="task2-panel-visible-20261107.js";
const script=read("test/"+scriptName);
const css=read("test/task2-process-split-20261107.css");
const html=read("test/index.html");
const build=JSON.parse(read("test/build-info.json"));
const gitBlob=(s)=>createHash("sha1").update(Buffer.from("blob "+Buffer.byteLength(s)+"\0")).update(s).digest("hex");

test("two process cards and stage labels remain visible before selection or document approval",()=>{
  assert.match(script,/const workflowNav=/);
  assert.match(script,/const lockedTabs=/);
  assert.match(script,/Пока нет согласованной перевозки|Нет перевозок на этапе исполнения/);
  assert.match(script,/root\.innerHTML=html\+.*lockedTabs/);
  assert.match(script,/Ожидается согласование транспортной заявки/);
  assert.match(script,/Перейти к транспортным заявкам/);
  const documentNav=read("test/issue28-document-navigation-20261107.js");
  assert.match(documentNav,/transport-applications/);
  assert.match(documentNav,/approved-shipments/);
});
test("transport application and execution have different routes and statuses",()=>{
  assert.match(script,/location\.hash="#transport-applications"/);
  assert.match(script,/data-section="approved-shipments"/);
  assert.match(script,/Статус транспортной заявки/);
  assert.match(script,/Статус исполнения/);
  assert.match(script,/Согласование транспортной заявки — отдельный бизнес-процесс/);
});

test("physical execution is gated by approved transport document",()=>{
  assert.match(script,/else if\(d\.booking_state!=="approved"\)/);
  assert.match(script,/Исполнение и трекинг откроются после согласования документа Владельцем/);
  assert.match(script,/Документальный процесс завершён: транспортная заявка согласована/);
  assert.match(script,/if\(state\.tab==="stages"\)/);
  assert.match(script,/if\(state\.tab==="completion"\|\|state\.tab==="arrival"\)/);
});

test("execution has independent stages, tracking, documents, completion and history",()=>{
  for(const [key,heading] of [
    ["overview","Обзор"],["stages","Этапы перевозки"],["track","Трекинг"],
    ["documents","Документы исполнения"],["completion","Завершение"],["claims","Претензии и акты"],["history","История"]
  ]) assert.ok(script.includes('["'+key+'","'+heading+'"]'),key);
  for(const text of ["Фактический выход груза","Движение груза","Прибытие на ПТО",
    "Проверка документов ВЭД","Таможенное оформление","Приёмка на складе","Закрытие перевозки"])assert.ok(script.includes(text),text);
  assert.match(css,/\.t2-milestones/);
  assert.match(css,/\.t2-process-banner/);
  assert.match(css,/@media\(max-width:600px\)/);
});

test("published test HTML points to content-addressed workflow assets",()=>{
  assert.equal(build.issue28.environment,"staging");
  assert.equal(build.issue28.productionChanged,false);
  assert.equal(build.task2.frontendScript,scriptName);
  assert.equal(build.task2.frontendSha,gitBlob(script));
  assert.ok(html.includes(scriptName+"?v="+gitBlob(script).slice(0,12)));
  assert.ok(html.includes("task2-process-split-20261107.css?v="+gitBlob(css).slice(0,12)));
  assert.ok(html.includes("issue28-document-navigation-20261107.js?v="+gitBlob(read("test/issue28-document-navigation-20261107.js")).slice(0,12)));
  assert.ok(!html.includes('src="./task2-panel-260ba5a1c29f.js'));
  assert.match(html,/ibclzdkxiozbzmniiygv\.supabase\.co/);
  assert.doesNotMatch(html,/ooclsrndeygojtofuyte/);
});
