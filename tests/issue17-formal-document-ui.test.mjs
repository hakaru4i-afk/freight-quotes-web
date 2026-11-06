import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(new URL('../test/'+file,import.meta.url),'utf8');
const panel=read('task2-panel-260ba5a1c29f.js');
const panelCurrent=read('task2-panel.js');
const i18n=read('task2-i18n.js');
const guidance=read('task2-guidance-42dc6ccc8a20.js');
const editor=read('transport-application-editor.mjs');
const css=read('transport-application.css');
const index=read('index.html');
test('formal customs and warehouse labels in Task2 workspace',()=>{
  for(const source of [panel,panelCurrent,i18n,guidance]){
    assert.doesNotMatch(source,/растаможк/iu);
  }
  assert.match(panel,/Дата завершения таможенного оформления/);
  assert.match(panel,/Дата завершения импортного таможенного оформления \(Минск\)/);
  assert.match(panel,/Дата приёмки груза на складе/);
  assert.match(i18n,/Customs clearance completion date/);
  assert.match(i18n,/进口清关完成日期/);
});
test('form uses a formal title in RU, EN and ZH and no inline technical source tags',()=>{
  assert.match(editor,/ЗАЯВКА НА ПЕРЕВОЗКУ ГРУЗА/);
  assert.match(editor,/FREIGHT TRANSPORT APPLICATION/);
  assert.match(editor,/货物运输委托申请书/);
  assert.match(editor,/transport-document-header/);
  assert.match(editor,/Согласованная стоимость перевозки/);
  assert.doesNotMatch(editor,/source&&r\('small'/);
  assert.match(editor,/name:'action',value:'submit'/);
  assert.match(editor,/onCorrection\(values\._correction\)/);
});
test('all deployed hashed editor copies use the same formal renderer',()=>{
  for(const name of ['transport-application-editor-8c01c7cdb211.mjs','transport-application-editor-8e72562b2e35.mjs']){
    assert.equal(read(name),editor);
  }
});
test('formal print surface and responsive layout remain readable',()=>{
  assert.match(css,/transport-document-header/);
  assert.match(css,/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css,/@media print/);
  assert.match(css,/@media\(max-width:\s*680px\)/);
  assert.match(css,/color-scheme:\s*light/);
  assert.doesNotMatch(css,/pointer-events:\s*none/);
});
test('staging refreshes versioned static assets without changing API or production paths',()=>{
  for(const val of ['transport-application.css?v=issue17-formal-20261106',
                    'task2-panel-260ba5a1c29f.js?v=issue47-formal-20261106',
                    'task2-i18n.js?v=issue47-formal-20261106',
                    'task2-guidance-42dc6ccc8a20.js?v=issue47-formal-20261106']){
    assert.ok(index.includes(val),val);
  }
  assert.match(index,/ibclzdkxiozbzmniiygv\.supabase\.co/);
  assert.doesNotMatch(index,/ooclsrndeygojtofuyte/);
});
