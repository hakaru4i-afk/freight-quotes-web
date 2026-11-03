import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('test/task2-guidance.js','utf8');
const data={};
vm.runInNewContext(source.slice(source.indexOf('const hints='),source.indexOf('const helpLanguage='))+';this.hints=hints;this.faq=helpQuestions;',data);
const context={window:{}};
vm.runInNewContext(fs.readFileSync('test/task2-help-i18n.js','utf8'),context);
test('every Task2 field-help category and FAQ entry has an English and Chinese translation',()=>{
 for(const language of ['en','zh']){
  const locale=context.window.task2HelpLocales[language];
  assert.equal(locale.hints.length,data.hints.length);
  assert.equal(locale.faq.length,data.faq.length);
  for(const hint of locale.hints)assert.ok(typeof hint==='string'&&hint.length>10);
  for(const item of locale.faq){assert.equal(item.length,2);assert.ok(item[0].length>5&&item[1].length>30);}
 }
});
test('help updates on language changes and customer values stay out of static translation',()=>{
 assert.ok(source.includes('attributeFilter:["lang"]'));
 assert.ok(source.includes('locale?.faq||helpQuestions'));
 const i18n=fs.readFileSync('test/task2-i18n.js','utf8');
 assert.ok(i18n.includes('.t2-readonly strong,.t2-chat,.t2-item span'));
});
