import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const source=readFileSync('test/task2-guidance.js','utf8'),ru={};runInNewContext(source.slice(source.indexOf('const hints='),source.indexOf('const helpLanguage='))+';this.faq=helpQuestions;',ru);const c={window:{}};runInNewContext(readFileSync('test/task2-help-i18n.js','utf8'),c);
const all={ru:ru.faq,en:c.window.task2HelpLocales.en.faq,zh:c.window.task2HelpLocales.zh.faq};
for(const[l,faq]of Object.entries(all))test(l+' current FAQ preserves one pre-PTO task, explicit outcomes and no separate warehouse review',()=>{
 const text=faq[8][1];assert.match(text,/1000/);assert.match(text,/Владельц|Owner|货主/);assert.match(text,/замечани|remarks|意见/);assert.match(text,/открыт|open|未完成/);assert.match(faq[9][1],/не создаются|No separate|不会分别/);assert.match(faq[6][1],/Будущ|Future|不得晚于/);
});
