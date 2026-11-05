import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const script=readFileSync(new URL("../test/task2-guidance.js",import.meta.url),"utf8");
const first=script.indexOf("function normalizeExcelChoice(");
const last=script.indexOf("async function importCSV(",first);
assert.ok(first>=0&&last>first,"Source must include insurance normalization before import");
const normalize=runInNewContext(script.slice(first,last)+"\nnormalizeExcelChoice;");
const opts=(name,allowed)=>({tagName:"SELECT",multiple:false,name,options:[
 {value:"",textContent:"Выберите",disabled:true},
 ...allowed.map(x=>({value:x,textContent:x,disabled:false}))
]});
const insurance=opts("v1.insurance",["Включено","Не включено","По согласованию"]);
const currency=opts("v1.currency",["USD","EUR","CNY","BYN","RUB"]);
const danger=opts("v1.dangerousGoods",["unknown","no","yes"]);

test("Excel insurance accepts exact value, normalized whitespace, casing and common yes/no",()=>{
 for(const [raw,expect] of [["Включено","Включено"],[" включено ","Включено"],["ДА","Включено"],["yes","Включено"],["НЕ ВКЛЮЧЕНО","Не включено"],["нет","Не включено"],["По согласованию","По согласованию"],["upon agreement","По согласованию"]]){
  assert.equal(normalize(insurance,raw,"Страхование"),expect,raw);
 }
});
test("unknown insurance is not silently approved, other enum unknown remains valid",()=>{
 for(const raw of ["unknown","Не определено","N/A","—","-"]){
  assert.equal(normalize(insurance,raw,"Страхование"),"",raw);
 }
 assert.equal(normalize(danger,"unknown","Опасность груза"),"unknown");
});
test("currency matching is case-insensitive, invalid insurance explains the permitted options",()=>{
 assert.equal(normalize(currency," cny ","Валюта"),"CNY");
 assert.throws(()=>normalize(insurance,"Списать расходы","Страхование"),/Включено.*Не включено.*По согласованию/);
 assert.equal(normalize({tagName:"INPUT",name:"amount"}," 100.00 ","Сумма ставки"),"100.00");
});
test("import validation runs before any form mutation and reports skipped placeholders",()=>{
 assert.match(script,/const mapped=headers\.map\(/);
 assert.match(script,/const unselected=mapped\.filter\(/);
 assert.match(script,/for\(const x of changes\)validateCsvCell\(x\.element,x\.value,x\.key\)/);
 assert.match(script,/for\(const \{element,value\} of changes\)setReactValue\(element,value\)/);
});
