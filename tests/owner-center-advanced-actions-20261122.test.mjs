import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('portal-feedback-center-20261107.js');

test('Owner manual status editor is collapsed and never replaces workflow handoff',()=>{
 assert.match(source,/const updateControls=data\.owner&&choices\.length\?'<details class="pf-owner-advanced">/);
 assert.match(source,/<summary>'\+esc\(ownerExtra\[byLang\]\.manual\)/);
 assert.match(source,/id="pf-update"/);
 assert.match(source,/id="pf-codex-handoff"/);
 assert.match(source,/data-pf="release-update"/);
 assert.doesNotMatch(source,/const updateControls=data\.owner&&choices\.length\?'<form/);
});
test('No raw missing Github token or secret injection in client, with localized help',()=>{
 const helper=source.match(/const ownerExtra=\{[\s\S]*?\n\};/)?.[0];
 assert.ok(helper,'localized Owner instructions');
 for(const locale of ['ru:','en:','zh:'])assert.ok(helper.includes(locale));
 assert.ok(source.includes('GITHUB_TOKEN_NOT_CONFIGURED'));
 assert.ok(source.includes('GITHUB_OWNER_REGISTER_TOKEN'));
 assert.ok(source.includes('Не вводите токен в карточку.'));
 assert.doesNotMatch(source,/github_pat_|ghp_|SUPABASE_SERVICE_ROLE_KEY/);
});
test('Staging and production center source remain byte-for-byte identical',()=>{
 assert.equal(source,read('test/portal-feedback-center-20261107.js'));
});

test('Failed GitHub handoff remains an error, preserves retry and never reports Codex started',()=>{
 assert.match(source,/catch\(e\)\{const raw=String\(e\?\.message\|\|'Неизвестная ошибка'\)/);
 assert.match(source,/error=\/GITHUB_TOKEN_NOT_CONFIGURED\/\.test\(raw\)\?ownerExtra\[byLang\]\.githubToken/);
 assert.match(source,/finally\{const failure=error;handoffBusy=false;await load\(\);if\(failure\)error=failure;render\(\);\}/);
 assert.match(source,/Это ещё не подтверждение запуска модели Codex/);
 assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*TOKEN/);
});

test('Release control remains fail-closed across task selection and failed readiness reads',()=>{
 assert.match(source,/const isReleaseReady=\(item,isOwner,readiness\)=>isOwner===true&&\['in_progress','release'\]\.includes\(item\?\.status\)&&readiness\?\.taskId===item\.id&&readiness\?\.ready===true/);
 assert.match(source,/const releaseReady=isReleaseReady\(item,data\.owner,releaseReadiness\)/);
 assert.match(source,/data-pf="release-update"/);
 assert.match(source,/\(!releaseReady\|\|busy\?'disabled':''\)/);
 assert.match(source,/response\.ok&&result\.ok===true&&result\.ready===true&&result\.status==='READY'/);
 assert.match(source,/if\(seq!==releaseReadinessRequest\|\|selected!==item\.id\)return/);
});
