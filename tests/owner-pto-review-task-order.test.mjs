import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const canonical=readFileSync("test/task2-panel.js","utf8");
const served=readFileSync("test/task2-panel-sidebar-only-20261107.js","utf8");
const tasks=readFileSync("test/lw-pending-tasks-all-roles-20261109.js","utf8");
test("Canonical and served Task2 UI match with VED-before-PTO milestones",()=>{
 assert.equal(canonical,served);
 const checked=canonical.indexOf('["4","Проверка документов ВЭД"');
 const arrived=canonical.indexOf('["5","Прибытие на ПТО"');
 assert.ok(checked>=0&&arrived>checked);
 assert.doesNotMatch(canonical,/\["4","Прибытие на ПТО"/);
});
test("Owner home reads real workflow tasks and opens selected shipment",()=>{
 assert.match(tasks,/get\("\/api\/pending-tasks"\)/);
 assert.match(tasks,/t\.task_type==="other"/);
 assert.match(tasks,/startsWith\("owner-pto:"\)/);
 assert.match(tasks,/Запустить проверку документов ВЭД/);
 assert.match(tasks,/carrier-flow-open-execution/);
 assert.match(tasks,/approved-shipments/);
});
