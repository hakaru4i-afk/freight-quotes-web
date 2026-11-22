import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from "node:vm";
const live=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const workflow=readFileSync('.github/workflows/owner-portal-release.yml','utf8');
test('one visible release button and exactly matching UI for production and staging',()=>{
 assert.equal(live,stage);
 assert.equal(live,candidate);
 assert.ok(live.includes('data-pf="release-update"'));
 assert.ok(!live.includes('data-pf="prepare-release"'));
});
test('Owner can release after verified task progress reaches 100%',()=>{
 const gate=live.split('\n').find(s=>s.startsWith('const isReleaseReady='));
 assert.ok(gate.includes("isOwner===true"));
 assert.ok(gate.includes("execution?.progress===100"));
 assert.ok(gate.includes("execution?.checksPassed===true"));
 assert.ok(!gate.includes('readiness?.passed===4'));
 assert.ok(live.includes("!releaseReady||isRunning||isConfirmed||busy?'disabled':''"));
 assert.ok(live.includes("action:'release_update'"));
});
test('protected Mac release runs only on Owner dispatch with quick checks, API and Pages',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.match(workflow,/github.actor == 'hakaru4i-afk'/);
 assert.match(workflow,/runs-on: \[self-hosted, macOS, ARM64, freight-mac-qa\]/);
 assert.match(workflow,/node --check portal-feedback-center-20261107\.js/);
 assert.doesNotMatch(workflow,/node scripts\/release\/owner-portal-verify-evidence\.mjs/);
 assert.match(workflow,/supabase functions deploy freight-api/);
 assert.match(workflow,/actions\/deploy-pages@v4/);
});
test('deep browser tests can be run manually but do not run for ordinary pushes',()=>{
 const deep=readFileSync('.github/workflows/owner-main-e2e.yml','utf8');
 assert.doesNotMatch(deep,/^  push:/m);
 assert.match(deep,/workflow_dispatch:/);
});
test('cabinet help is available in RU EN ZH, and builder packages the checked candidate',()=>{
 for(const locale of ["ru:{","en:{","zh:{"])assert.ok(live.includes(locale));
 assert.match(live,/Бэкапы и E2E отдельно/);
 assert.match(readFileSync('scripts/release/owner-portal-pages.mjs','utf8'),/release\/owner-portal-feedback-center-20261122\.js/);
});

test('task status names the blocker in three languages without a development percentage',()=>{
 const start=live.indexOf('const taskStatusLabels=');
 const end=live.indexOf('const readinessReasonKeys=',start);
 for(const [lang,waiting,failed,ready] of [
  ['ru','В работе. Ожидаем PR','Ошибка проверки task-e2e','Все проверки пройдены'],
  ['en','In progress. Waiting for a pull request','The task-e2e check failed','Checks passed'],
  ['zh','开发中，等待拉取请求','task-e2e 检查失败','检查已通过']
 ]){
  const context={byLang:lang,releaseT:()=>({readySummary:ready})};
  runInNewContext(live.slice(start,end)+'globalThis.statusText=taskStatusText;',context);
  assert.equal(context.statusText({progress:50,step:'code_committed_pr_required'}), waiting);
  assert.equal(context.statusText({progress:50,step:'task_e2e_failed'}), failed);
  assert.equal(context.statusText({progress:100,checksPassed:true}),ready);
  assert.notEqual(context.statusText({progress:100,checksPassed:false}),ready);
 }
 const panel=live.split('\n').find(line=>line.includes('const progressPanel='));
 assert.doesNotMatch(panel,/<progress|%/);
});
