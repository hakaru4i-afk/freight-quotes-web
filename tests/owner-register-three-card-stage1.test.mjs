import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const load=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const source=load('owner-register-task-actions-20261121.js');
const blob=s=>{const b=Buffer.from(s);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex').slice(0,12);};
class FakeElement{
 constructor(tag){this.tagName=tag.toLowerCase();this.children=[];this.dataset={};this.attributes={};this.className='';this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.classList={toggle:(name,on)=>{const c=new Set(this.className.split(/\s+/).filter(Boolean));if(on)c.add(name);else c.delete(name);this.className=[...c].join(' ');}};}
 append(...children){this.children.push(...children)}
 setAttribute(name,value){this.attributes[name]=String(value)}
 focus(){this.focused=true}
}
const walk=(n,fn)=>[n,...n.children.flatMap(c=>walk(c,fn))].filter(fn);
const byClass=(n,c)=>walk(n,e=>e.className.split(/\s+/).includes(c));
const byTag=(n,t)=>walk(n,e=>e.tagName===t);
function component(lang='ru'){
 const win={},doc={documentElement:{lang},createElement:t=>new FakeElement(t)};
 vm.runInNewContext(source,{window:win,document:doc,Map,Set});
 return win.OWRegisterTaskActions;
}
test('source assets are equal in / and /test/ and every entrypoint pins current Git blob',()=>{
 for(const name of ['owner-registers-20261111.js','owner-register-task-actions-20261121.js','owner-register-task-actions-20261121.css'])
  assert.equal(load(name),load('test/'+name),'prod/test mismatch '+name);
 for(const page of ['index.html','test/index.html']){
  const html=load(page);
  for(const name of ['owner-registers-20261111.js','owner-register-task-actions-20261121.js','owner-register-task-actions-20261121.css'])
   assert.ok(html.includes('./'+name+'?v='+blob(load('test/'+name))),page+' stale cache key '+name);
  assert.ok(html.indexOf('<script src="./owner-register-task-actions-20261121.js')<html.indexOf('<script src="./owner-registers-20261111.js'),'shared controls must load first');
 }
});
test('all three registers use the same component exactly once, without original in-card launch action',()=>{
 const owner=load('owner-registers-20261111.js');
 assert.equal((owner.match(/OWRegisterTaskActions\?\.render/g)||[]).length,1);
 assert.match(owner,/register:id,row,job,state/);
 assert.doesNotMatch(owner,/const start=el\('button','Взять в работу'/);
 assert.deepEqual(Array.from(component().registers).sort(),['developments','remarks','updates']);
});
test('development, remarks, updates cards all have three actions, a date and 0% progress (no status dropdown)',()=>{
 for(const register of ['developments','remarks','updates']){
  const card=component().render({register,row:{id:'T-1',title:'QA'},state:'new'});
  assert.equal(card.dataset.register,register);
  assert.equal(byClass(card,'ow-task-btn').length,3);
  assert.equal(byTag(card,'select').length,0);
  assert.equal(byClass(card,'ow-task-deadline-input')[0].type,'date');
  assert.equal(byClass(card,'ow-task-progress-value')[0].textContent,'0%');
  assert.equal(byClass(card,'ow-task-universal-track')[0].attributes['aria-valuenow'],'0');
 }
});
test('start requires a deadline and cannot invoke database or webhook before Stage 2',()=>{
 const card=component().render({register:'developments',row:{id:'TASK-2'},state:'new'});
 const start=byClass(card,'ow-task-btn-start')[0],date=byClass(card,'ow-task-deadline-input')[0],note=byClass(card,'ow-task-inline-info')[0];
 start.onclick();assert.match(note.textContent,/Укажите плановую дату/);
 date.value='2026-12-15';date.oninput();start.onclick();assert.match(note.textContent,/Этапе 2/);
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|WebSocket/);
});
test('defer and reject always request an explanatory reason, never save it during Stage 1',()=>{
 const card=component().render({register:'remarks',row:{id:'TASK-3'},state:'new'});
 for(const action of ['postpone','reject']){
  byClass(card,'ow-task-btn-'+action)[0].onclick();
  const textarea=byClass(card,'ow-task-reason-textarea')[0],panel=byClass(card,'ow-task-reason')[0],note=byClass(card,'ow-task-inline-info')[0];
  assert.equal(panel.hidden,false);
  textarea.value='';byClass(card,'ow-task-reason-apply')[0].onclick();assert.match(note.textContent,/не менее 5 символов/);
  textarea.value='Нужна дополнительная проверка';byClass(card,'ow-task-reason-apply')[0].onclick();
  assert.equal(panel.hidden,true);assert.match(note.textContent,/не записываются в базу/);
 }
});
test('historical, published, and active tasks do not allow duplicate start actions',()=>{
 for(const x of [{row:{id:'T1',historyOnly:true},state:'new'},{row:{id:'T2'},state:'published'},{row:{id:'T3'},job:{status:'in_progress'},state:'in_progress'}]){
  const card=component().render({register:'updates',...x});
  assert.ok(byClass(card,'ow-task-btn').every(b=>b.disabled));
 }
});
test('all RU, EN, ZH labels and mobile layout remain supported',()=>{
 for(const [language,text] of [['ru','Запустить в разработку'],['en','Start development'],['zh','开始开发']]){
  const card=component(language).render({register:'updates',row:{id:'UI'},state:'new'});
  assert.equal(byClass(card,'ow-task-btn-start')[0].textContent,text);
 }
 const css=load('owner-register-task-actions-20261121.css');
 assert.match(css,/@media\(max-width:660px\)/);
 assert.match(css,/grid-template-columns:1fr/);
});
