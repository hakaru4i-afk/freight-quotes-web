import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync("test/task2-panel.js","utf8");
const start=source.indexOf(" const csv={");
const end=source.indexOf("\n async function onSubmit",start);
assert.ok(start>=0&&end>start,"CSV implementation must exist");
const sandbox={};
vm.runInNewContext(source.slice(start,end)+"\nglobalThis.exposedCsv=csv;",sandbox);
const csv=sandbox.exposedCsv;
const native=value=>JSON.parse(JSON.stringify(value));

test("CSV: quoted semicolons, multiline values and negative numbers are preserved",()=>{
 const data='order_code;amount;note\r\n"C26EM080961";"-123.50";"два; слова\nи перенос"\r\n';
 const rows=native(csv.parse(data));
 assert.deepEqual(rows,[["order_code","amount","note"],["C26EM080961","-123.50","два; слова\nи перенос"]]);
 assert.equal(csv.quote("-123.50"),'"-123.50"');
});
test("CSV: quoted separators are not incorrectly counted as delimiters",()=>{
 const data='"note, comma, comma";amount\n"hello, world";5\n';
 assert.deepEqual(native(csv.parse(data)),[["note, comma, comma","amount"],["hello, world","5"]]);
});
test("CSV: tabs and BOM supported",()=>{
 assert.deepEqual(native(csv.parse("\uFEFFname\tdate\nbox\t2026-11-03\n")),[["name","date"],["box","2026-11-03"]]);
});
test("CSV: invalid and impossible dates rejected",()=>{
 const d={name:"new_plan_date",type:"datetime-local",tagName:"INPUT"};
 assert.throws(()=>csv.normalize(d,"2026-02-31 09:30"),/Дата\/время/);
 assert.throws(()=>csv.normalize(d,"2026-11-03 27:30"),/время/);
 assert.equal(csv.normalize(d,"2026-11-03 09:30"),"2026-11-03T09:30");
 const day={name:"ready_date",type:"date",tagName:"INPUT"};
 assert.throws(()=>csv.normalize(day,"31.02.2026"),/Дата/);
 assert.equal(csv.normalize(day,"03.11.2026"),"2026-11-03");
});
test("CSV: unbalanced quotes and mismatched row widths rejected",()=>{
 assert.throws(()=>csv.parse('a;b\n"hello;2\n'),/кавычка/);
 assert.throws(()=>csv.parse("a;b\n1\n"),/разное количество/);
});
test("Task #2: container follow-up displays actual result and no duplicate hint",()=>{
 assert.match(source,/result=await call\(\{\.\.\.payload,answer:yes\?"yes":"no"\}\)/);
 assert.match(source,/result\.finished\?"Перевозка завершена\./);
 assert.match(source,/label\.dataset\.task2Explained/);
});
