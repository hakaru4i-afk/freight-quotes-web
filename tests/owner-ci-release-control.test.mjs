import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const live=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const gate=live.match(/const isReleaseReady=.*?;\n/);
test('Published and candidate UI share the owner authorization condition',()=>{
 assert.equal(stage.match(/const isReleaseReady=.*?;\n/)?.[0],gate?.[0]);
});
test('Owner-only gate requires confirmed 100 percent work, not backup or SHA certificates',()=>{
 assert.ok(gate);
 const ctx={};runInNewContext(gate[0]+'\nglobalThis.ready=isReleaseReady;',ctx);
 const item={id:'id',status:'release'},done={decision:'accepted',step:'ready_for_review',checksPassed:true};
 assert.equal(ctx.ready(item,true,null,done),true);
 for(const a of [
 [item,false,null,done],
 [item,true,null,{step:'branch_awaiting_codex',checksPassed:false}],
 [item,true,null,{step:'codex_writing',checksPassed:true}],
 [item,true,null,{step:'ready_for_review',checksPassed:false}],
 [item,true,null,{...done,decision:'review_pending'}],
 [{...item,status:'completed'},true,null,done]
 ])assert.equal(ctx.ready(...a),false);
});
test('one button starts protected release, no separate preflight control',()=>{
 assert.ok(live.includes('data-pf="release-update"'));
 assert.ok(live.includes("action:'release_update'"));
 assert.ok(!live.includes('data-pf="prepare-release"'));
});

test('Owner sees confirmed production only for a successful exact run and attempt',()=>{
 const source=stage.slice(stage.indexOf('const releaseStageWords='),stage.indexOf('const codexErrorLabels='));
 const base={status:'published',stage:'verified-production',progress:100,runId:45678901234,runAttempt:2};
 for(const [byLang,published,backup,blocked] of [
  ['ru','Выпущено. Production проверен.','Создаётся резервная копия и проверяется восстановление.','Фактическая публикация не подтверждена.'],
  ['en','Released. Production has been verified.','Creating the backup and testing recovery.','The deployed release is unverified.'],
  ['zh','已发布，生产环境已验证。','正在创建备份并验证恢复。','尚未验证实际发布结果。'],
 ]){
  const context={byLang,releaseT:()=>({unstarted:'fallback'})};
  runInNewContext(source+'globalThis.describe=releaseProgressText;globalThis.confirmed=isPublicationConfirmed;',context);
  assert.equal(context.describe(base),published);
  assert.equal(context.describe({status:'in_progress',stage:'backup'}),backup);
  assert.equal(context.describe({status:'failed',reason:'PRODUCTION_READBACK_UNPROVEN'}),blocked);
  for(const edit of [{stage:'publishing-pages'},{progress:66},{runId:'45678901234'},{runAttempt:undefined}]){
   assert.equal(context.confirmed({...base,...edit}),false);
   assert.equal(context.describe({...base,...edit}),blocked);
  }
 }
 assert.match(stage,/acceptedPhase&&isConfirmed/);
 assert.doesNotMatch(stage,/runState\.status==='published'\)\);/);
});
