import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const shared=source('owner-register-task-actions-20261121.js');
const digest=s=>{const b=Buffer.from(s);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex').slice(0,12)};
class Element{
 constructor(tag){this.tagName=tag.toLowerCase();this.children=[];this.className='';this.dataset={};this.attributes={};this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.style={};this.classList={toggle:(name,on)=>{const a=new Set(this.className.split(/\s+/).filter(Boolean));on?a.add(name):a.delete(name);this.className=[...a].join(' ')}}}
 append(...v){this.children.push(...v)}
 setAttribute(k,v){this.attributes[k]=String(v)}
 focus(){this.focused=true}
}
const all=(n,p)=>[n,...n.children.flatMap(c=>all(c,p))].filter(p),cls=(n,c)=>all(n,e=>e.className.split(/\s+/).includes(c));
function ui(lang='ru'){
 const win={},document={documentElement:{lang},createElement:tag=>new Element(tag)};
 vm.runInNewContext(shared,{window:win,document,Map,Set,Number,Promise});
 return win.OWRegisterTaskActions;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('single implementation serves developments, remarks and updates, never offers a status select',()=>{
 assert.deepEqual(Array.from(ui().registers).sort(),['developments','remarks','updates']);
 for(const register of ['developments','remarks','updates']){
  const card=ui().render({register,row:{id:'R1'},state:'new',onAction:async()=>{}});
  assert.equal(cls(card,'ow-task-btn').length,3);
  assert.equal(all(card,e=>e.tagName==='select').length,0);
  assert.equal(cls(card,'ow-task-deadline-input')[0].type,'date');
  assert.equal(cls(card,'ow-task-universal-track')[0].attributes['aria-valuenow'],'0');
 }
});
test('all three actions are sent to the Owner API callback, start requires deadline',async()=>{
 const calls=[],card=ui().render({register:'remarks',row:{id:'R2'},state:'new',onAction:async x=>calls.push(x)});
 cls(card,'ow-task-btn-start')[0].onclick();await tick();assert.equal(calls.length,0);
 const date=cls(card,'ow-task-deadline-input')[0];date.value='2027-04-28';date.oninput();
 cls(card,'ow-task-btn-start')[0].onclick();await tick();
 assert.equal(calls[0].action,'start');assert.equal(calls[0].deadline,'2027-04-28');
});
test('postpone and reject require 10 characters and retain reason in server payload',async()=>{
 for(const action of ['postpone','reject']){
  const calls=[],card=ui().render({register:'updates',row:{id:'R'+action},state:'new',onAction:async x=>calls.push(x)});
  cls(card,'ow-task-btn-'+action)[0].onclick();
  const textarea=cls(card,'ow-task-reason-textarea')[0];textarea.value='short';
  cls(card,'ow-task-reason-apply')[0].onclick();await tick();assert.equal(calls.length,0);
  textarea.value='Требуется дополнительная экспертиза';
  cls(card,'ow-task-reason-apply')[0].onclick();await tick();
  assert.equal(calls[0].action,action==='postpone'?'defer':'reject');
  assert.equal(calls[0].reason,textarea.value);
 }
});
test('100% means only server-reported exact CI with checksPassed; review action appears then',async()=>{
 const input={register:'developments',row:{id:'R3'},state:'in_progress',execution:{decision:'in_progress',progress:100,checksPassed:false}};
 const call=[];
 const notReady=ui().render({...input,onAction:async x=>call.push(x)});
 assert.equal(cls(notReady,'ow-task-review-submit').length,0);
 const ready=ui().render({...input,execution:{decision:'in_progress',progress:100,checksPassed:true},onAction:async x=>call.push(x)});
 assert.equal(cls(ready,'ow-task-universal-track')[0].attributes['aria-valuenow'],'100');
 cls(ready,'ow-task-review-submit')[0].onclick();await tick();assert.equal(call[0].action,'submit_review');
});
test('Owner may reject but cannot accept when review CI evidence expires',()=>{
 const card=ui().render({register:'developments',row:{id:'EXPIRED'},state:'checking',
  execution:{decision:'review_pending',progress:90,checksPassed:false},onAction:async()=>{}});
 const accept=cls(card,'ow-task-btn-start').find(x=>x.textContent==='Принять');
 const reject=cls(card,'ow-task-btn-reject').find(x=>x.textContent==='Отклонить приёмку');
 assert.equal(accept.disabled,true);assert.equal(reject.disabled,false);
});
test('Owner review panel implements accept and reject-with-reason',async()=>{
 const actions=[],card=ui().render({register:'developments',row:{id:'R4'},state:'checking',
  execution:{decision:'review_pending',progress:100,checksPassed:true},onAction:async x=>actions.push(x)});
 cls(card,'ow-task-btn-start').find(x=>x.textContent==='Принять').onclick();await tick();
 assert.equal(actions[0].action,'accept');
 cls(card,'ow-task-btn-reject').find(x=>x.textContent==='Отклонить приёмку').onclick();
 const textarea=cls(card,'ow-task-reason-textarea')[0];textarea.value='Нужно исправить вывод отчёта';
 cls(card,'ow-task-reason-apply')[0].onclick();await tick();
 assert.equal(actions[1].action,'reject_review');
});
test('cannot restart completed or historical work; no arbitrary GitHub token/progress in request',()=>{
 for(const props of [{row:{id:'H',historyOnly:true},state:'new'},{row:{id:'P'},state:'published'},{row:{id:'C'},job:{status:'completed'},state:'accepted'}]){
  const card=ui().render({register:'remarks',...props,onAction:async()=>{}});
  assert.ok(cls(card,'ow-task-btn').every(x=>x.disabled));
 }
 assert.doesNotMatch(shared,/fetch\(|github_pat_|ghp_|service_role|localStorage|sessionStorage/);
});
test('Owner register main script uses authenticated API and 60-second polling',()=>{
 const root=source('owner-registers-20261111.js');
 assert.match(root,/owner-register-execution\?register=/);
 assert.match(root,/action:'dispatch'/);
 assert.match(root,/OWRegisterTaskActions\?\.render\(\{register:id,row,job,state,execution,onAction:executeRecordAction\}\)/);
 assert.match(root,/60000/);
});
test('production and staging candidate source stays byte-identical and pinned',()=>{
 for(const file of ['owner-registers-20261111.js','owner-register-task-actions-20261121.js','owner-register-task-actions-20261121.css']){
  assert.equal(source(file),source('test/'+file));
  for(const page of ['index.html','test/index.html'])assert.ok(source(page).includes('./'+file+'?v='+digest(source(file))));
 }
});
test('RU, EN, ZH supported and mobile buttons stack at 390px',()=>{
 for(const [language,label] of [['ru','Запустить в разработку'],['en','Start development'],['zh','开始开发']])
  assert.equal(cls(ui(language).render({register:'updates',row:{id:'Lang'+language},state:'new',onAction:async()=>{}}),'ow-task-btn-start')[0].textContent,label);
 assert.match(source('owner-register-task-actions-20261121.css'),/@media\(max-width:660px\)/);
});
