import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(name,'utf8');
const ui=read('release/owner-portal-feedback-center-20261122.js');
const handoff=read('.github/workflows/owner-register-task-dispatch.yml');
const codex=read('.github/workflows/owner-register-codex-exec.yml');
const release=JSON.parse(read('production-release-manifest.json'));
const sh65plus=Number(/^SH-01\.30\.(\d+) v$/.exec(release.businessVersion)?.[1]||0)>=65;
test('Owner UI matches approved release mode in RU EN ZH',()=>{
 if(sh65plus){
  for(const label of ['Запустить разработку','Start development','启动开发'])assert.ok(ui.includes(label));
  assert.match(ui,/id="pf-development-handoff"/);
  assert.match(ui,/data-pf="copy-development-prompt"/);
  assert.doesNotMatch(ui,/data-pf="start-codex"|action:'run_codex'/);
  return;
 }
 assert.match(ui,/Передать в GitHub/);
 assert.match(ui,/Запустить Codex/);
 assert.match(ui,/Send to GitHub/);
 assert.match(ui,/Start Codex/);
 assert.match(ui,/提交到 GitHub/);
 assert.match(ui,/启动 Codex/);
 assert.match(ui,/id="pf-codex-handoff"/);
 assert.match(ui,/data-pf="start-codex"/);
 assert.match(ui,/action:'run_codex'/);
 assert.match(ui,/action,register:execution.register/);
});
test('GitHub handoff only creates branch and Issue, no model launched',()=>{
 assert.match(handoff,/Create work branch without pretending implementation commits exist/);
 assert.match(handoff,/Register task with source brief for Codex/);
 assert.doesNotMatch(handoff,/codex exec|Run Codex \(non-interactive\)/);
});
test('Separate Codex workflow executes headless stdin prompt and reports exact safe codes',()=>{
 assert.match(codex,/workflow_dispatch:/);
 assert.match(codex,/run-name: Codex task/);
 assert.match(codex,/codex exec --ephemeral --sandbox workspace-write -/);
 assert.match(codex,/CODEX_FAILURE_CODE:/);
 assert.match(codex,/CODEX_NETWORK_BLOCKED_403/);
 assert.match(codex,/gh pr create --draft/);
 assert.match(codex,/pull-requests: write/);
});
test('Production, test and approved release scripts are byte-identical',()=>{
 assert.equal(read('portal-feedback-center-20261107.js'),ui);
 assert.equal(read('test/portal-feedback-center-20261107.js'),ui);
});

test('Owner handoff state is explicit after GitHub dispatch and not falsely completed',()=>{
 if(sh65plus){
  assert.match(ui,/githubHandoffReady/);
  assert.match(ui,/branch_awaiting_codex/);
  assert.doesNotMatch(ui,/runCodexStart\(/);
  return;
 }
 assert.match(ui,/execution\?\.codexStatus==='branch_awaiting_codex'\|\|execution\?\.step==='branch_awaiting_codex'/);
 assert.match(ui,/execution\?\.codexStatus==='branch_awaiting_codex'&&execution\?\.step==='code_committed_pr_required'/);
});
