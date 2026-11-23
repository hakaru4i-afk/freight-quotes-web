import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('release/candidates/owner-workflow-lifecycle-20261123.js','utf8');
test('lifecycle javascript is valid for deployment',()=>{assert.doesNotThrow(()=>new Function(ui))});
test('owner task lifecycle requires real checked review, then acceptance before release',()=>{
 assert.match(ui,/const isReleaseReady=.*item\?\.status==='release'&&execution\?\.decision==='accepted'&&execution\?\.checksPassed===true/);
 assert.match(ui,/data-pf="submit-review"/);
 assert.match(ui,/data-pf="accept-review"/);
 assert.match(ui,/action==='submit-review'\?'submit_review':'accept'/);
 assert.doesNotMatch(ui,/transitions\[item\.status\].*\[.completed.,.release.\]/);
});
test('rework form has required comment, history, and GitHub relay',()=>{
 assert.match(ui,/id="pf-rework"/);
 assert.match(ui,/textarea name="reason" minlength="10" maxlength="1000"/);
 assert.match(ui,/action==='return_for_rework'&&reason\.trim\(\)\.length<10/);
 assert.match(ui,/ownerReviewAction\(item,'return_for_rework',f\.elements\.reason\.value\)/);
 assert.match(ui,/Комментарий сохранится в истории и будет отправлен в GitHub Issue/);
});
test('archiving requires published evidence; active and archive lists are separate',()=>{
 assert.match(ui,/statusFilter="active"/);
 assert.match(ui,/statusFilter==='archive'/);
 assert.match(ui,/data-pf="archive-published"/);
 assert.match(ui,/action:'archive_published',id:item\.id,expectedStatus:item\.status/);
 assert.match(ui,/alreadyPublished\|\|\(acceptedPhase&&runState\.status==='published'\)/);
 assert.match(ui,/statusFilter='archive'/);
});
test('labels are localized and no paid model or Mac Codex action is launched',()=>{
 for(const s of ['Вернуть на доработку','Return for rework','退回修改','Подтвердить выпуск и в архив'])assert.ok(ui.includes(s));
 assert.doesNotMatch(ui,/action:'run_codex'|data-pf="start-codex"/);
});
