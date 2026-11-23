import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from "node:vm";
const live=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const workflow=readFileSync('.github/workflows/owner-portal-release.yml','utf8');
test('published UI matches its receipt and the proposed Pages UI matches staging',()=>{
 const manifest=JSON.parse(readFileSync('production-release-manifest.json','utf8'));
 assert.equal(createHash('sha256').update(live).digest('hex'),manifest.assets['portal-feedback-center-20261107.js']);
 assert.equal(stage,candidate);
 assert.ok(candidate.includes('data-pf="release-update"'));
 assert.ok(!candidate.includes('data-pf="prepare-release"'));
});
test('Owner can release after verified task progress reaches 100%',()=>{
 const gate=candidate.split('\n').find(s=>s.startsWith('const isReleaseReady='));
 assert.ok(gate.includes("isOwner===true"));
 assert.ok(gate.includes("execution?.progress===100"));
 assert.ok(gate.includes("execution?.checksPassed===true"));
 assert.ok(!gate.includes('readiness?.passed===4'));
 assert.ok(candidate.includes("!releaseReady||isRunning||isConfirmed||busy?'disabled':''"));
 assert.ok(candidate.includes("action:'release_update'"));
});
test('Owner-only UI release uses quick checks, Pages and no private repo token',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 // A one-time user-approved repair may run on a precisely guarded push.
 assert.match(workflow,/^  push:\n    branches: \[main\]/m);
 assert.match(workflow,/github.actor == 'hakaru4i-afk'/);
 assert.match(workflow,/github.event.head_commit.message == 'fix\(crm\): repair one-click release without cross-repo token'/);
 assert.match(workflow,/runs-on: ubuntu-latest/);
 assert.match(workflow,/node --check test\/portal-feedback-center-20261107\.js/);
 assert.doesNotMatch(workflow,/BACKEND_RELEASE_READ_TOKEN/);
 assert.doesNotMatch(workflow,/supabase functions deploy freight-api/);
 assert.doesNotMatch(workflow,/node scripts\/release\/owner-portal-verify-evidence\.mjs/);
 assert.match(workflow,/actions\/deploy-pages@v4/);
});
test('deep browser tests can be run manually but do not run for ordinary pushes',()=>{
 const deep=readFileSync('.github/workflows/owner-main-e2e.yml','utf8');
 assert.doesNotMatch(deep,/^  push:/m);
 assert.match(deep,/workflow_dispatch:/);
});
test('cabinet help is available in RU EN ZH, and builder packages the checked candidate',()=>{
 for(const locale of ["ru:{","en:{","zh:{"])assert.ok(candidate.includes(locale));
 assert.match(candidate,/Бэкапы и E2E отдельно/);
 assert.match(readFileSync('scripts/release/owner-portal-pages.mjs','utf8'),/release\/owner-portal-feedback-center-20261122\.js/);
});

test('task status names the blocker in three languages without a development percentage',()=>{
 const start=candidate.indexOf('const taskStatusLabels=');
 const end=candidate.indexOf('const readinessReasonKeys=',start);
 for(const [lang,waiting,failed,ready] of [
  ['ru','В работе. Ожидаем PR','Ошибка проверки task-e2e','Все проверки пройдены'],
  ['en','In progress. Waiting for a pull request','The task-e2e check failed','Checks passed'],
  ['zh','开发中，等待拉取请求','task-e2e 检查失败','检查已通过']
 ]){
  const context={byLang:lang,releaseT:()=>({readySummary:ready})};
  runInNewContext(candidate.slice(start,end)+'globalThis.statusText=taskStatusText;',context);
  assert.equal(context.statusText({progress:50,step:'code_committed_pr_required'}), waiting);
  assert.equal(context.statusText({progress:50,step:'task_e2e_failed'}), failed);
  assert.equal(context.statusText({progress:100,checksPassed:true}),ready);
  assert.notEqual(context.statusText({progress:100,checksPassed:false}),ready);
 }
 const panel=candidate.split('\n').find(line=>line.includes('const progressPanel='));
 assert.doesNotMatch(panel,/<progress|%/);
});
