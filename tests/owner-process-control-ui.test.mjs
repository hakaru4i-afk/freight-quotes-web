import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
for(const path of ['lw-pending-tasks-all-roles-20261109.js','test/lw-pending-tasks-all-roles-20261109.js']){
 test('Owner control renders only server-approved operation, escapes text and excludes prior/requesting recipient: '+path,()=>{
  const src=readFileSync(path,'utf8');
  const start=src.indexOf('const CONTROL_ID='),end=src.indexOf('function paintControl()',start);
  assert.ok(start>=0&&end>start);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {controlForm,controlWords}=runInNewContext(src.slice(start,end)+'\n;({controlForm,controlWords})',{esc});
  const task={id:'task',revision:'r1',actions:['reassign_logistic'],assigned_login:'OLD',requested_by:'requester'};
  const people=[{login:'old'},{login:'requester'},{login:'new',name:'<img onerror=alert(1)>'}];
  for(const lang of ['ru','en','zh']){
   const html=controlForm(task,people,controlWords[lang]);
   assert.match(html,/value="new"/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|value="old"|value="requester"/);assert.match(html,/name="confirmed" type="checkbox" required/);
   assert.equal(controlForm({...task,blocker:'AWARD_CHANGED_OR_MISSING'},people,controlWords[lang]),'');
   assert.equal(controlForm({...task,actions:[]},people,controlWords[lang]),'');
  }
  assert.match(src,/p.ownerControl!==true\|\|p.ok!==true/);
  assert.match(src,/expectedRevision:task.revision/);
  assert.match(src,/if\(state.role!=="owner"\)/);
  assert.match(src,/clearControl\(\);state.role=""/);
 });
}

for(const path of ['lw-pending-tasks-all-roles-20261109.js','test/lw-pending-tasks-all-roles-20261109.js']){
 test('document transition form exposes only server-approved operation: '+path,()=>{
  const src=readFileSync(path,'utf8'),start=src.indexOf('const CONTROL_ID='),end=src.indexOf('function paintControl()',start);
  const {documentControlForm,controlWords}=runInNewContext(src.slice(start,end)+';({documentControlForm,controlWords})',{esc:v=>String(v??'')});
  for(const lang of ['ru','en','zh']){
   const task={id:'task',revision:'r1',actions:['document_start','owner_override_money']};
   const html=documentControlForm(task,controlWords[lang]);
   assert.match(html,/value="document_start"/);assert.doesNotMatch(html,/document_reopen|document_complete|owner_override_money/);
   assert.match(html,/name="confirmed" type="checkbox" required/);assert.equal(documentControlForm({...task,revision:null},controlWords[lang]),'');
   assert.equal(documentControlForm({...task,blocker:'AWARD_CHANGED_OR_MISSING'},controlWords[lang]),'');
  }
  assert.match(src,/action:"owner_transition_document_task"/);assert.match(src,/expectedRevision:task.revision/);
 });
}
