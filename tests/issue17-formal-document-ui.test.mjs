import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read = file => fs.readFileSync(new URL('../test/'+file,import.meta.url),'utf8');
const panel=read('task2-panel-visible-20261107.js');
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
  assert.match(editor,/ПОРУЧЕНИЕ НА ОРГАНИЗАЦИЮ ПЕРЕВОЗКИ ГРУЗА/);
  assert.match(editor,/FREIGHT TRANSPORT INSTRUCTION/);
  assert.match(editor,/货物运输组织委托书/);
  assert.match(editor,/transport-document-header/);
  assert.match(editor,/Согласованная стоимость перевозки/);
  assert.doesNotMatch(editor,/source&&r\('small'/);
  assert.match(editor,/name:'action',value:'submit'/);
  assert.match(editor,/onCorrection\(values\._correction\)/);
});
test('current build references source-identical versioned document modules',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../test/build-info.json',import.meta.url),'utf8'));
  const modules=manifest.carrierDocument?.moduleAssets||[];
  assert.equal(modules.length,2,'model/editor build artifacts missing');
  const modelName=modules.find(n=>n.startsWith('transport-application-model-'));
  const editorName=modules.find(n=>n.startsWith('transport-application-editor-'));
  assert.ok(modelName&&editorName,'document modules missing');
  assert.equal(read(modelName),read('transport-application-model.mjs'));
  assert.equal(read(editorName),editor);
});
test('formal print surface and responsive layout remain readable',()=>{
  assert.match(css,/transport-document-header/);
  assert.match(css,/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css,/@media print/);
  assert.match(css,/@media\(max-width:\s*680px\)/);
  assert.match(css,/color-scheme:\s*light/);
  assert.doesNotMatch(css,/pointer-events:\s*none/);
});
test('staging uses exact asset-content SHA prefixes for cache-busting',()=>{
  const blob = file => {
    const buf=fs.readFileSync(new URL('../test/'+file,import.meta.url));
    return createHash('sha1').update('blob '+buf.length+String.fromCharCode(0)).update(buf).digest('hex');
  };
  const resources=['transport-application.css','app.js','task2-panel-visible-20261107.js','task2-i18n.js','task2-guidance-42dc6ccc8a20.js'];
  for(const file of resources){
    assert.ok(index.includes(file+'?v='+blob(file).slice(0,12)),file+' has stale version in staging HTML');
  }
  assert.match(index,/ibclzdkxiozbzmniiygv\.supabase\.co/);
  assert.doesNotMatch(index,/ooclsrndeygojtofuyte/);
});
