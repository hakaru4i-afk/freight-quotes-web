import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const original=readFileSync("test/task2-guidance.js","utf8");
const marker="new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:[\"lang\"]});";
assert.ok(original.includes(marker),"test harness requires the actual guidance module");
const code=original.replace(marker,
  "globalThis.csvQA={parseCSV,quoted,validateCsvCell,importCSV};");
const fake={
  MutationObserver:class{observe(){}},
  document:{documentElement:{},addEventListener(){}},
  window:{addEventListener(){}},
  requestAnimationFrame(){},
  setTimeout(){},
  console,
  confirm:()=>true,
  alert(){},
  HTMLInputElement:class{},
  HTMLSelectElement:class{},
  HTMLTextAreaElement:class{}
};
vm.runInNewContext(code,fake,{timeout:1500});
const {parseCSV,quoted,validateCsvCell,importCSV}=fake.csvQA;
const row=csv=>Array.from(parseCSV(csv),a=>Array.from(a));

test("preserve negative numbers in exported CSV; neutralize formulas",()=>{
 assert.equal(quoted("-15.25"),'"-15.25"');
 assert.equal(quoted("-0.1"),'"-0.1"');
 assert.equal(quoted("=HYPERLINK(1)"),'"\'=HYPERLINK(1)"');
 assert.equal(quoted("@SUM(A1)"),'"\'@SUM(A1)"');
 assert.equal(quoted("-cmd"),'"\'-cmd"');
});
test("UTF-8 BOM, semicolon and multiline quoted values",()=>{
 assert.deepEqual(row('\uFEFForder;note;amount\r\n"000123";"Привет,\n你好 ""Тест""";"-12.50"\r\n'),[
  ["order","note","amount"],["000123",'Привет,\n你好 "Тест"','-12.50']
 ]);
});
test("commas and TAB are supported",()=>{
 assert.deepEqual(row('a,b\n"x,y","z"\n'),[["a","b"],["x,y","z"]]);
 assert.deepEqual(row('a\tb\n123\t你好\n'),[["a","b"],["123","你好"]]);
});
test("malformed files rejected instead of changing forms",()=>{
 for(const c of ["a;a\n1;2\n","a;b\n1\n","a;b\n1;2\n3;4\n","a;b\n\"broken;2\n","a;b\n\"quoted\"extra;2\n","a;b\n1;2;3\n"]){
  assert.throws(()=>parseCSV(c),/CSV|кавычк|столбц|колонк|разделител/,c);
 }
});
test("validate dates, numeric leading zero, bounds and ranges",()=>{
 const d={type:"date",maxLength:-1};
 assert.doesNotThrow(()=>validateCsvCell(d,"2027-01-02","ready"));
 assert.throws(()=>validateCsvCell(d,"2027-02-30","ready"),/дат/);
 assert.throws(()=>validateCsvCell(d,"02.01.2027","ready"),/дат/);
 const n={type:"number",maxLength:-1,min:"0",max:"100"};
 assert.doesNotThrow(()=>validateCsvCell(n,"-0","price")); // min allows zero
 assert.throws(()=>validateCsvCell(n,"-2","price"),/границ/);
 assert.throws(()=>validateCsvCell(n,"000123","price"),/число/);
 assert.throws(()=>validateCsvCell(n,"1e30","price"),/число/);
 assert.doesNotThrow(()=>validateCsvCell({type:"text",maxLength:-1},"000123","tracking"));
});
test("invalid later field never partially imports previous field",async()=>{
 const fields=[
  {name:"text",type:"text",readOnly:false,disabled:false,value:"before",maxLength:200},
  {name:"date",type:"date",readOnly:false,disabled:false,value:"2026-10-20",maxLength:-1}
 ];
 const form={querySelectorAll:()=>fields};
 await assert.rejects(importCSV(form,{text:async()=>"text;date\nchanged;2027-02-30\n"}),/date|дат/i);
 assert.equal(fields[0].value,"before");
 assert.equal(fields[1].value,"2026-10-20");
});
