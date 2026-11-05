import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.match(html,/task2-guidance\.js\?v=/);
});
test("Issue 47: XLSX archive contains one distinct cell per form field", async () => {
  const api=loadCodec();
  assert.ok(api && typeof api.makeXlsx==="function" && typeof api.unzip==="function");
  const headers=["Перевозчик","Контактное лицо","Сумма ставки","Валюта","Дата забора груза"];
  const values=["Тестовый перевозчик","ООО & Сыновья; Иванов","-100.50","USD","2026-11-05"];
  const bytes=api.makeXlsx([headers,values]);
  const signature=new DataView(bytes.buffer).getUint32(0,true);
  assert.equal(signature,0x04034b50, "must be ZIP / OOXML, not plain CSV");
  const entries=await api.unzip(bytes.buffer);
  assert.deepEqual([...entries.keys()].sort(),["[Content_Types].xml","_rels/.rels","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","xl/worksheets/sheet1.xml"].sort());
  const worksheet=entries.get("xl/worksheets/sheet1.xml");
  for(const address of ["A1","B1","C1","D1","E1","A2","B2","C2","D2","E2"]){
    assert.match(worksheet,new RegExp('r="'+address+'"'));
  }
  assert.match(worksheet,/ООО &amp; Сыновья; Иванов/);
  assert.match(worksheet,/-100\.50/);
  assert.match(entries.get("xl/workbook.xml"),/Ставка перевозчика/);
});
