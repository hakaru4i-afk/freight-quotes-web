import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const codec = readFileSync(new URL("../test/carrier-csv-wps-hotfix.js", import.meta.url), "utf8");
const guidance = readFileSync(new URL("../test/task2-guidance.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../test/index.html", import.meta.url), "utf8");

function loadCodec(){
  const window = {};
  runInNewContext(codec, { window, location:{pathname:"/test/"}, TextEncoder, TextDecoder,
    Uint8Array, DataView, ArrayBuffer, Date, Map, Math, Object, String, Number, RegExp });
  return window.freightXlsxInterop;
}
test("Issue 47: carrier quote exporter is native Excel, not a CSV rename", () => {
  assert.match(guidance,/const bytes=api\.makeXlsx\(/);
  assert.match(guidance,/\.xlsx";/);
  assert.match(guidance,/rows=parseCSV\(api\.xlsxToCsv\(await api\.unzip\(/);
  assert.match(guidance,/Скачать Excel-шаблон/);
  assert.match(guidance,/Загрузить Excel/);
  assert.match(html,/carrier-csv-wps-hotfix\.js\?v=/);
  assert.match(html,/task2-guidance-42dc6ccc8a20\.js\?v=/);
});
test("Issue 47: XLSX archive contains one distinct cell per form field", async () => {
  const api=loadCodec();
  assert.ok(api && typeof api.makeXlsx==="function" && typeof api.unzip==="function");
  const headers=["Перевозчик","Контактное лицо","Сумма ставки","Валюта","Дата забора груза"];
  const values=["Тестовый перевозчик","ООО & Сыновья; Иванов","-100.50","USD","2026-11-05"];
  const bytes=api.makeXlsx([headers,values]);
  writeFileSync("/tmp/issue47-carrier-generated.xlsx", Buffer.from(bytes));
  const signature=new DataView(bytes.buffer).getUint32(0,true);
  assert.equal(signature,0x04034b50, "must be ZIP / OOXML, not plain CSV");
  const entries=await api.unzip(bytes.buffer);
  assert.deepEqual([...entries.keys()].sort(),["[Content_Types].xml","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","xl/worksheets/sheet1.xml"].sort());
  const worksheet=entries.get("xl/worksheets/sheet1.xml");
  for(const address of ["A1","B1","C1","D1","E1","A2","B2","C2","D2","E2"]){
    assert.match(worksheet,new RegExp('r="'+address+'"'));
  }
  assert.match(worksheet,/ООО &amp; Сыновья; Иванов/);
  assert.match(worksheet,/-100\.50/);
  assert.match(entries.get("xl/workbook.xml"),/Ставка перевозчика/);
  const styles=entries.get("xl/styles.xml");
  assert.match(styles,/color rgb="FF20332E"/);
  assert.doesNotMatch(styles,/patternType="solid"/);
  assert.doesNotMatch(worksheet,/<autoFilter/);
  assert.match(styles,/wrapText="1"/);

});

test("Issue 47: Excel/WPS validity dates accept human and ISO formatting", () => {
  const from=guidance.indexOf("function validCalendarDate(s){");
  const to=guidance.indexOf("function validateCsvCell(element,value,key){",from);
  assert.ok(from>=0&&to>from);
  const normalize=runInNewContext(guidance.slice(from,to)+"\nnormalizeExcelDate",{Date,Number,String,Error});
  for(const value of ["05.11.2026","5.11.2026","05/11/2026","2026/11/05","2026-11-05","2026-11-05 12:30:00","2026-11-05T00:00:00Z"])
    assert.equal(normalize(value,"Ставка действует до"),"2026-11-05",value);
  const serial=(Date.UTC(2026,10,5)-Date.UTC(1899,11,30))/86400000;
  assert.equal(normalize(String(serial),"Ставка действует до"),"2026-11-05");
  for(const invalid of ["31.11.2026","29.02.2026","2026-13-05","гггг-мм-дд","0"])
    assert.throws(()=>normalize(invalid,"Ставка действует до"),/дата .* неверна/,invalid);
  assert.match(guidance,/element\.type==="date"&&value!==""\)return normalizeExcelDate\(value,key\)/);
  assert.match(guidance,/element\.type==="number"&&value!==""\)/);
});
