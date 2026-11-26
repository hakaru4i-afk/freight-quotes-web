import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from "node:vm";
const live=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const workflow=readFileSync('.github/workflows/owner-portal-release.yml','utf8');
test('published UI matches its production receipt and the historical Pages candidate',()=>{
 const manifest=JSON.parse(readFileSync('production-release-manifest.json','utf8'));
 assert.match(manifest.assets['portal-feedback-center-20261107.js'],/^[a-f0-9]{64}$/);
 assert.equal(live,candidate,'main must contain exactly the approved P0 UI');
 const releaseMatch=/^SH-01\.30\.(\d+) v$/.exec(manifest.businessVersion);
 assert.ok(releaseMatch&&Number(releaseMatch[1])>=64,'Issue #173 requires the approved SH64 (or later) production receipt');
 assert.equal(createHash('sha256').update(live).digest('hex'),manifest.assets['portal-feedback-center-20261107.js'],'published Owner UI must match the verified production asset digest');
 assert.ok(candidate.includes('data-pf="release-update"'));
 assert.ok(!candidate.includes('data-pf="prepare-release"'));
});
test('staging entrypoint uses the current owner UI content hash',()=>{
 const index=readFileSync('test/index.html','utf8');
 const cacheKey=createHash('sha1').update('blob '+Buffer.byteLength(stage)+'\0').update(stage).digest('hex').slice(0,12);
 assert.ok(index.includes('portal-feedback-center-20261107.js?v='+cacheKey));
});
test('Owner can release after verified task progress reaches 100%',()=>{
 const gate=candidate.split('\n').find(s=>s.startsWith('const isReleaseReady='));
 assert.ok(gate.includes("isOwner===true"));
 assert.ok(gate.includes("execution?.step==='ready_for_review'"));
 assert.ok(gate.includes("execution?.checksPassed===true"));
 assert.ok(!gate.includes('readiness?.passed===4'));
 assert.ok(candidate.includes("!releaseReady||isRunning||isConfirmed||busy?'disabled':''"));
 assert.ok(candidate.includes("action:'release_update'"));
});
test('Owner-only release requires the locked pair, backup and verified API before Pages',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 // Every future production publication must originate from the Owner button.
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.match(workflow,/github.actor == 'hakaru4i-afk'/);
 assert.match(workflow,/github.event_name == 'workflow_dispatch'/);
 assert.match(workflow,/deploy-pages:[\s\S]*?runs-on: [^\n]+inputs\.release_runner/);
 assert.match(workflow,/release_runner:[\s\S]*?default: github/);
 assert.match(workflow,/release-tests:\n    if: github.event_name == 'pull_request'\n    runs-on: ubuntu-latest/);
 assert.match(workflow,/locked-release\.mjs evidence/);
 assert.match(workflow,/locked-release\.mjs backup/);
 assert.match(workflow,/needs\.backup\.result == 'success'/);
 assert.match(workflow,/locked-release-api\.mjs publish/);
 assert.match(workflow,/actions\/deploy-pages@v4/);
});
test('deep browser tests can be run manually but do not run for ordinary pushes',()=>{
 const deep=readFileSync('.github/workflows/owner-main-e2e.yml','utf8');
 assert.doesNotMatch(deep,/^  push:/m);
 assert.match(deep,/workflow_dispatch:/);
});
test('cabinet help explains verified recovery and owner approval in all locales',()=>{
 for(const locale of ["ru:{","en:{","zh:{"])assert.ok(stage.includes(locale));
 assert.match(stage,/полной приёмки, проверенного восстановления и подтверждения владельца/);
 assert.match(stage,/complete acceptance, verified recovery, and Owner approval/);
 assert.match(stage,/完成验收、恢复验证和所有者批准/);
 assert.doesNotMatch(stage,/Бэкапы и E2E отдельно|do not block release|不阻止发布/);
 assert.match(readFileSync('scripts/release/owner-portal-pages.mjs','utf8'),/release\/owner-portal-feedback-center-20261122\.js/);
});

test('task status names the blocker in three languages without a development percentage',()=>{
 const start=candidate.indexOf('const taskStatusLabels=');
 const end=candidate.indexOf('const readinessReasonKeys=',start);
 for(const [lang,waiting,failed,ready] of [
  ['ru','Код создан, ожидается PR','Ошибка проверки task-e2e','Проверки пройдены, готов к приёмке'],
  ['en','In progress. Waiting for a pull request','The task-e2e check failed','Checks passed, ready for review'],
  ['zh','开发中，等待拉取请求','task-e2e 检查失败','检查已通过，等待验收']
 ]){
  const context={byLang:lang,releaseT:()=>({readySummary:ready})};
  runInNewContext(candidate.slice(start,end)+'globalThis.statusText=taskStatusText;',context);
  assert.equal(context.statusText({step:'code_committed_pr_required'}), waiting);
  assert.equal(context.statusText({step:'task_e2e_failed'}), failed);
  assert.equal(context.statusText({step:'ready_for_review',checksPassed:true}),ready);
  assert.notEqual(context.statusText({step:'ready_for_review',checksPassed:false}),ready);
 }
 const panel=candidate.split('\n').find(line=>line.includes('const progressPanel='));
 assert.doesNotMatch(panel,/<progress|%/);
});
