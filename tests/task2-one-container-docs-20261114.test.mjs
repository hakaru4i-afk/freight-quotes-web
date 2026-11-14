import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync('test/task2-panel-sidebar-only-20261107.js','utf8');
const html=readFileSync('test/index.html','utf8');
const css=readFileSync('test/task2-execution-layout-20261114.css','utf8');

test('canonical container editor is displayed once',()=>{
  assert.doesNotMatch(code, /Указанные контейнеры/);
  assert.doesNotMatch(code, /html\+='\<h3\>Контейнеры/);
  assert.match(code, /data-t2-form="container"/);
  assert.match(code, /t2-container-existing/);
  assert.match(code, /4\. Контейнеры/);
});
test('shared shipment documents have origin sections without duplicate rows',()=>{
  assert.match(code,/t2-docs-overview/);
  for(const name of ['Документы владельца','Документы ВЭД','Документы перевозчика'])assert.ok(code.includes(name));
  assert.match(code,/allDocs\.forEach\(f=>groupedDocs\[sourceOf\(f\)\]\.push\(f\)\)/);
  assert.match(code,/data-t2-doc/);
  assert.match(code,/data-t2-form="upload"/);
});
test('staging loads aligned forms and current script version',()=>{
  assert.match(html,/task2-execution-layout-20261114\.css/);
  assert.match(html,/task2-panel-sidebar-only-20261107\.js\?v=1ab6db2ba041/);
  assert.match(css,/t2-actual-row/);
  assert.match(css,/t2-document-item/);
});
test('invalid baseline falls back to original request pickup where possible',()=>{
  assert.match(code,/fmt\(o\.pickup\)/);
  assert.match(code,/Уточните исходную дату/);
});
