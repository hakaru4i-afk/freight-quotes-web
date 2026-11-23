import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('release/candidates/owner-chatgpt-handoff-20261123.js','utf8');
const workflow=readFileSync('.github/workflows/owner-register-task-dispatch.yml','utf8');
test('Owner button is localized and calls existing start+dispatch, not Codex',()=>{
 for(const label of ['Запустить разработку','Start development','启动开发'])assert.ok(ui.includes(label));
 assert.match(ui,/id="pf-development-handoff"/);
 assert.match(ui,/await call\('start'\)/);
 assert.match(ui,/await call\('dispatch'\)/);
 assert.doesNotMatch(ui,/data-pf="start-codex"|action:'run_codex'|runCodexStart\(/);
});
test('GitHub register runs on free Linux without AI API or Mac',()=>{
 assert.match(ui,/developmentChatPrompt\(execution\)/);
 assert.match(ui,/navigator\.clipboard\?\.writeText/);
 assert.match(ui,/checksPassed===true&&execution\?\.step==='ready_for_review'/);
 assert.match(workflow,/runs-on: ubuntu-latest/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/GITHUB_BRANCH_AND_ISSUE_READY/);
 assert.doesNotMatch(workflow,/codex exec|openai\.com|OPENAI_API_KEY/);
});
test('historical Codex HTTP 403 cannot trigger retry in the new UI',()=>{
 assert.match(ui,/githubRegistered=Boolean/);
 assert.match(ui,/startsWith\('CODEX_'\)/);
 assert.doesNotMatch(ui,/!codexNetworkBlocked/);
 assert.match(ui,/copy-development-prompt/);
});
