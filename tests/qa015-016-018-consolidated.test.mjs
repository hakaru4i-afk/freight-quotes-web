import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../test/"+name,import.meta.url),"utf8");
const panel=read("task2-panel-sidebar-only-20261107.js");
const canonical=read("task2-panel.js");
const route=read("global-view/view.mjs");
const html=read("index.html");

test("Task2 and canonical execution scripts parse and preserve the same functional patterns",()=>{
  assert.doesNotThrow(()=>new Function(panel));
  assert.doesNotThrow(()=>new Function(canonical));
  for(const p of [panel,canonical]){
    assert.match(p,/<global-route-view data-route=/);
    assert.match(p,/data-t2-form="weekly-point"/);
    assert.match(p,/data-t2-tab="track"/);
    assert.match(p,/data-t2-form="actual"/);
  }
});
test("QA-016 one Global View, no second standalone Yandex map or duplicated movement list",()=>{
  for(const p of [panel,canonical]){
    assert.doesNotMatch(p,/class="t2-map"/);
    assert.doesNotMatch(p,/html\+='<h3>Карта местоположения/);
    assert.doesNotMatch(p,/html\+='<h3>Движение груза<\/h3>/);
    assert.ok(p.indexOf('Еженедельный трекинг — контрольные точки Global View')>p.indexOf('<global-route-view'));
    assert.ok(p.indexOf('Еженедельный трекинг — контрольные точки Global View')<p.indexOf('Обновление перевозки'));
  }
  assert.match(route,/trackingHistory = history/);
  assert.match(route,/if \(trackingHistory\) activities\.append\(trackingHistory\)/);
  assert.match(route,/route\.mode==='road'/);
  assert.match(route,/result\.calculatedAt\?' · '/);
});
test("QA-018 embedded chat removed but documents and API remain",()=>{
  for(const p of [panel,canonical]){
    assert.doesNotMatch(p,/class="lw-ved-chat-mount"/);
    assert.doesNotMatch(p,/Общий чат: ВЭД · перевозчик · Владелец/);
    assert.match(p,/Документы и задачи ВЭД/);
    assert.match(p,/Загрузить документы/);
  }
  assert.match(html,/lw-ved-shared-chat-20261109\.js/);
});
test("QA-015 no yellow demand before a trusted actual departure and no road km for rail",()=>{
  for(const p of [panel,canonical]){
    assert.match(p,/const departed=!!\(actual&&Number\.isFinite/);
    assert.match(p,/const deadline=departed\?/);
    assert.match(p,/План трекинга — ожидается фактическое отправление/);
    assert.doesNotMatch(p,/overdue\?'Просрочен еженедельный трекинг':'Требуется обновить местоположение груза'/);
  }
});
