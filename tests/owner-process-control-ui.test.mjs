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

for(const path of ['lw-pending-tasks-all-roles-20261109.js','test/lw-pending-tasks-all-roles-20261109.js']){
 test('Owner risk controls are server-gated and history is escaped: '+path,()=>{
  const src=readFileSync(path,'utf8'),start=src.indexOf('const CONTROL_ID='),end=src.indexOf('function paintControl()',start);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {riskControlForm,controlWords}=runInNewContext(src.slice(start,end)+';({riskControlForm,controlWords})',{esc});
  for(const lang of ['ru','en','zh']){
   const task={id:'task',revision:'r1',riskRecordAllowed:true,riskHistory:[{decision:'accept',revision:'r0',actor:'owner',reason:'<img onerror=alert(1)>',createdAt:'2026-11-26'}]};
   const html=riskControlForm(task,controlWords[lang]);assert.match(html,/value="accept"/);assert.match(html,/value="withdraw"/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/name="confirmed" type="checkbox" required/);
   assert.doesNotMatch(riskControlForm({...task,riskRecordAllowed:false},controlWords[lang]),/<form/);
   assert.doesNotMatch(riskControlForm({...task,riskHistory:[]},controlWords[lang]),/value="withdraw"/);
  }
  assert.match(src,/action:"owner_record_process_risk"/);assert.match(src,/expectedRevision:task.revision,requestId,decision,reason,confirmed:true/);
 });
}

for(const path of ['lw-pending-tasks-all-roles-20261109.js','test/lw-pending-tasks-all-roles-20261109.js']){
 test('Partner control keeps actual roles separate and links only native workflows: '+path,()=>{
  const src=readFileSync(path,'utf8'),start=src.indexOf('const CONTROL_ID='),end=src.indexOf('function paintControl()',start);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {partnerControlRow,controlWords}=runInNewContext(src.slice(start,end)+';({partnerControlRow,controlWords})',{esc});
  for(const lang of ['ru','en','zh']){
   const task={source:'partners',role:'supplier',route:'supplier-orders',order_code:'QA',description:'<img onerror=alert(1)>',status:'completed',revision:0,nativeActions:['reopen']};
   const html=partnerControlRow(task,controlWords[lang]);assert.match(html,/href="#supplier-orders"/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|<form/);assert.match(html,/: 0/);
   assert.match(partnerControlRow({...task,role:'designer',route:'content-tasks',blocker:'WAITING_SUPPLIER'},controlWords[lang]),/href="#content-tasks"/);
   assert.equal(partnerControlRow({...task,route:'javascript:alert(1)'},controlWords[lang]),'');assert.equal(partnerControlRow({...task,role:'content'},controlWords[lang]),'');
  }
  assert.match(src,/scope==="partners"\?p.scope!=="partners"/);
 });
}

for(const path of ['lw-pending-tasks-all-roles-20261109.js','test/lw-pending-tasks-all-roles-20261109.js']){
 test('Draft unlock form is active, revision and server gated: '+path,()=>{
  const src=readFileSync(path,'utf8'),start=src.indexOf('const CONTROL_ID='),end=src.indexOf('function paintControl()',start);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {draftControlRow,controlWords}=runInNewContext(src.slice(start,end)+';({draftControlRow,controlWords})',{esc});
  for(const lang of ['ru','en','zh']){
   const task={id:'draft',order_code:'QA',notification_id:'notification',carrier_login:'<img onerror=alert(1)>',status:'active',revision:4,unlockAllowed:true};
   const html=draftControlRow(task,controlWords[lang]);assert.match(html,/data-lw-control-draft/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/name="confirmed" type="checkbox" required/);
   for(const patch of [{unlockAllowed:false},{revision:null},{revision:-1},{revision:'bad'}])assert.doesNotMatch(draftControlRow({...task,...patch},controlWords[lang]),/<form/);
   assert.equal(draftControlRow({...task,status:'resolved'},controlWords[lang]),'');
  }
  assert.match(src,/action:"resolve",order:task.order_code,notificationId:task.notification_id,expectedRevision:revision,reason,confirmed:true/);
 });
}

for(const path of ['lw-pending-tasks-all-roles-20261109.js','test/lw-pending-tasks-all-roles-20261109.js']){
 test('Partner recovery forms expose only server-approved, role-scoped operations: '+path,()=>{
  const src=readFileSync(path,'utf8'),start=src.indexOf('const CONTROL_ID='),end=src.indexOf('function paintControl()',start);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const {partnerControlForms,controlWords}=runInNewContext(src.slice(start,end)+';({partnerControlForms,controlWords})',{esc});
  for(const lang of ['ru','en','zh']){
   const task={id:'supplier:one',orderId:'one',source:'partners',role:'supplier',assignee:'old',revision:7,nativeActions:['edit','reopen','delete','design_edit']};
   const people=[{role:'supplier',login:'old'},{role:'supplier',login:'next',name:'<img onerror=alert(1)>'},{role:'designer',login:'other'}];
   const html=partnerControlForms(task,controlWords[lang],people);assert.match(html,/data-operation="edit"/);assert.match(html,/data-operation="reopen"/);assert.match(html,/value="next"/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|value="other"|value="old"|data-operation="delete"|data-operation="design_edit"/);assert.match(html,/name="confirmed" type="checkbox" required/);
   assert.equal(partnerControlForms({...task,nativeActions:[]},controlWords[lang],people),'');
   assert.equal(partnerControlForms({...task,revision:null},controlWords[lang],people),'');
  }
  assert.match(src,/const body=\{action,id:task.orderId,expectedRevision:revision,reason,confirmed:true,ownerProcess:true\}/);
 });
}
