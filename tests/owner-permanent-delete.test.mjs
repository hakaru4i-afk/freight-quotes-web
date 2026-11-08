import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const app=readFileSync("test/app.js","utf8");
const index=readFileSync("test/index.html","utf8");
const faq=readFileSync("test/current-workspace-help-20261108.js","utf8");
const ru=(word)=>[...word].map(c=>c.charCodeAt(0)>127?"\\u"+c.charCodeAt(0).toString(16).padStart(4,"0").toUpperCase():c).join("");
test("staging-only app has valid JavaScript and pinned cache revision",()=>{
 execFileSync(process.execPath,["--check","test/app.js"]);
 execFileSync(process.execPath,["--check","test/current-workspace-help-20261108.js"]);
 assert.match(index,/\.\/app\.js\?v=8a89e5acdfe3/);
 assert.match(index,/owner-command-center-20261108\.js/);
});
test("request registry never offers trash or restoration",()=>{
 assert.ok(!app.includes('type:"checkbox",checked:u,onChange:C=>y(C.target.checked)'),"Legacy trash checkbox must be removed");
 assert.ok(!app.includes('onClick:()=>{E("restore"),W("")}'),"Restore button must not exist");
 assert.ok(app.includes('!C.hidden&&('),"Invisible rows must stay excluded");
 assert.ok(app.includes(ru("Безвозвратное удаление заявки")),"Warning must explicitly say permanent");
 assert.ok(app.includes(ru("Удалить навсегда")),"Button must explicitly say permanent");
});
test("delete clears selected card instead of loading a missing request",()=>{
 assert.ok(app.includes('N==="delete"?(R(null),M(null),window.dispatchEvent(new Event("requests-updated")),await G()):await he()'));
 assert.ok(!app.includes(ru("История останется только владельцу в корзине.")));
});
test("Owner FAQ documents no trash and separately preserved archives in three languages",()=>{
 for(const entry of ["корзины","нет. Архив", "no trash or restore", "没有回收站"])
  assert.ok(faq.includes(entry),entry);
});
