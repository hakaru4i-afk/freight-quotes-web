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
test('registry is intake only: three actions, no deadline, progress or status selector',()=>{
 assert.deepEqual(Array.from(ui().registers).sort(),['developments','remarks','updates']);
 for(const register of ['developments','remarks','updates']){
  const card=ui().render({register,row:{id:'R1'},state:'new',onAction:async()=>{}});
  assert.equal(cls(card,'ow-task-btn').length,3);
  assert.equal(all(card,e=>e.tagName==='select').length,0);
  assert.equal(cls(card,'ow-task-deadline-input').length,0);
  assert.equal(cls(card,'ow-task-universal-track').length,0);
 }
});
test('one owner click transfers task to Center without demanding deadline or dispatching Codex',async()=>{
 const calls=[],card=ui().render({register:'remarks',row:{id:'R2'},state:'new',onAction:async x=>calls.push(x)});
 cls(card,'ow-task-btn-start')[0].onclick();await tick();
 assert.equal(calls.length,1);
 assert.equal(calls[0].action,'transfer');
 assert.equal(calls[0].register,'remarks');
 assert.equal(calls[0].recordId,'R2');
 assert.equal(Object.hasOwn(calls[0],'deadline'),false);
 assert.equal(Object.hasOwn(calls[0],'token'),false);
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
test('review and progress have a single authoritative place: Improvement Center',()=>{
 const active=ui().render({register:'developments',row:{id:'R3'},state:'in_progress',
  execution:{decision:'in_progress',progress:100,checksPassed:true},onAction:async()=>{}});
 assert.equal(cls(active,'ow-task-review-submit').length,0);
 assert.equal(cls(active,'ow-task-universal-track').length,0);
 const review=ui().render({register:'developments',row:{id:'R4'},state:'checking',
  execution:{decision:'review_pending',progress:100,checksPassed:true},onAction:async()=>{}});
 assert.equal(cls(review,'ow-task-owner-review').length,0);
 const center=source('portal-feedback-center-20261107.js');
 const sh65plus=Number(/^SH-01\.30\.(\d+) v$/.exec(JSON.parse(source('production-release-manifest.json')).businessVersion)?.[1]||0)>=65;
 assert.match(center,sh65plus?/pf-development-handoff/:/pf-codex-handoff/);
 assert.match(center,/runGithubHandoff/);
 assert.match(center,/fetchExecutions/);
 assert.match(center,/releaseReadiness/);
 assert.match(center,/data-pf="release-update"/);
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
 assert.match(root,/payload\.action==='transfer'/);
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
 for(const [language,label] of [['ru','Взять в работу'],['en','Move to improvement center'],['zh','移至改进中心']])
  assert.equal(cls(ui(language).render({register:'updates',row:{id:'Lang'+language},state:'new',onAction:async()=>{}}),'ow-task-btn-start')[0].textContent,label);
 assert.match(source('owner-register-task-actions-20261121.css'),/@media\(max-width:660px\)/);
});
