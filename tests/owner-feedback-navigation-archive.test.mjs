import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const registers=readFileSync('release/candidates/owner-registers-deeplink-sh69.js','utf8');
const center=readFileSync('release/candidates/portal-feedback-archive-sh69.js','utf8');

test('SH69 owner register links carry the exact existing feedback ID',()=>{
 assert.doesNotThrow(()=>new Function(registers));
 for(const marker of ['openFeedbackItem(execution?.feedbackId||job?.id)',
  'openFeedbackItem(execution?.feedbackId||job.id)',
  'openFeedbackItem(acceptanceExecutionFor(row)?.feedbackId||job.id)',
  'openFeedbackItem(item.id)'])assert.ok(registers.includes(marker),marker);
 assert.match(registers,/url\.searchParams\.set\('feedbackTask',String\(feedbackId\)\)/);
 assert.doesNotMatch(registers,/action:'set_status'/);
});

test('SH69 Improvement Center resolves direct link and opens archive filter',()=>{
 assert.doesNotThrow(()=>new Function(center));
 const start=center.indexOf('const feedbackTargetFromUrl=');
 const end=center.indexOf('let releaseReadiness=',start);
 assert.ok(start>0&&end>start);
 const id='f5912bc9-0a72-4d87-b6fe-6330c1510c30';
 const ctx={
  URL,location:{href:'https://example.test/portal?feedbackTask='+id+'#portal-feedback'},
  data:{owner:true,items:[{id,sender_role:'owner',status:'completed'}]},
  selected:'',registry:'developments',statusFilter:'active'
 };
 runInNewContext(center.slice(start,end)+'\nglobalThis.probe=()=>({applied:applyFeedbackTarget(),selected,registry,statusFilter});',ctx);
 const snapshot=ctx.probe();
 assert.equal(snapshot.applied,true);
 assert.equal(snapshot.selected,id);
 assert.equal(snapshot.registry,'all');
 assert.equal(snapshot.statusFilter,'archive');
 assert.match(center,/const targeted=applyFeedbackTarget\(\)/);
 assert.match(center,/window\.addEventListener\('portal-feedback-target-changed',syncFeedbackTarget\)/);
});

test('SH69 deep link fails closed for unknown, malformed and cross-role IDs',()=>{
 const start=center.indexOf('const feedbackTargetFromUrl=');
 const end=center.indexOf('let releaseReadiness=',start);
 assert.ok(start>0&&end>start);
 const valid='f5912bc9-0a72-4d87-b6fe-6330c1510c30';
 for(const scenario of [
  {target:valid,owner:true,items:[]},
  {target:valid,owner:true,items:[{id:valid,sender_role:'carrier',status:'completed'}]},
  {target:valid,owner:false,items:[{id:valid,sender_role:'owner',status:'completed'}]},
  {target:'not-a-uuid',owner:true,items:[{id:valid,sender_role:'owner',status:'completed'}]}
 ]){
  const ctx={URL,location:{href:'https://example.test/portal?feedbackTask='+scenario.target},
   data:{owner:scenario.owner,items:scenario.items},selected:'original',registry:'developments',statusFilter:'active'};
  runInNewContext(center.slice(start,end)+'\nglobalThis.probe=()=>({applied:applyFeedbackTarget(),selected,registry,statusFilter});',ctx);
  const result=ctx.probe();
  assert.equal(result.applied,false);
  assert.equal(result.selected,'original');
  assert.equal(result.registry,'developments');
  assert.equal(result.statusFilter,'active');
 }
});

test('SH69 archive status is verified by receipt, never an old failed Codex run',()=>{
 const start=center.indexOf('const taskStatusLabels=');
 const end=center.indexOf('const readinessReasonKeys=',start);
 assert.ok(start>0&&end>start);
 for(const [lang,verified,unverified] of [
  ['ru','Завершено и архивировано · публикация подтверждена','Завершено и архивировано · протокол публикации не подтверждён'],
  ['en','Completed and archived · publication verified','Completed and archived · publication receipt unverified'],
  ['zh','已完成并归档 · 发布已验证','已完成并归档 · 发布凭据未验证']
 ]){
  const ctx={byLang:lang};
  runInNewContext(center.slice(start,end)+'\nglobalThis.getStatus=taskStatusText;',ctx);
  assert.equal(ctx.getStatus({publicationVerified:true,step:'stored',lastError:'CODEX_NETWORK_BLOCKED_403'},
    {status:'completed'}),verified);
  assert.equal(ctx.getStatus({publicationVerified:false,step:'codex_failed'}, {status:'completed'}),unverified);
 }
 assert.match(center,/item\.status!=='completed'&&execution\.lastError/);
 assert.match(center,/Подтверждение публикации/);
 assert.match(center,/Исторический запуск GitHub/);
});

test('SH68 production assets remain unchanged until a separate approved Pages release',()=>{
 const mainRegister=readFileSync('owner-registers-20261111.js','utf8');
 const mainCenter=readFileSync('portal-feedback-center-20261107.js','utf8');
 assert.notEqual(mainRegister,registers);
 assert.notEqual(mainCenter,center);
});
