import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('release/candidates/owner-registers-lifecycle-sh68.js','utf8');
test('SH68 owner register UI parses and supports all three registers',()=>{
 assert.doesNotThrow(()=>new Function(ui));
 for(const key of ['remarks','developments','updates'])assert.ok(ui.includes(key));
 assert.match(ui,/for\(const id of \['remarks','developments','updates'\]\)/);
});
test('all transferred records remain visible with a link to improvement center',()=>{
 assert.match(ui,/return \(row\.title\+' '\+row\.description\)/);
 assert.match(ui,/if\(transferred\(row\)\)/);
 assert.match(ui,/Задача перенесена в Центр доработок/);
 assert.doesNotMatch(ui,/\(!transferred\(row\)\|\|view==='archive'\)/);
});
test('legacy acceptance cannot bypass verified review, GitHub rework comment or archive',()=>{
 assert.doesNotMatch(ui,/acceptanceDecision\(|action:'set_status'|acceptanceDialog\(/);
 assert.doesNotMatch(ui,/yes\.onclick=\(\)=>void acceptanceDecision/);
 assert.match(ui,/Приёмка и возврат на доработку доступны в Центре доработок/);
});
test('linked task creation uses owner-register-execution and preserves existing task',()=>{
 assert.match(ui,/fetch\('\/api\/owner-register-execution',\{method:'POST'/);
 assert.match(ui,/action:'transfer',register:row\.register,recordId:row\.id/);
 assert.doesNotMatch(ui,/action:'start_register',register:row\.register,recordId:row\.id/);
});
test('acceptance journal reads verified workflow decisions in remarks, developments and updates',()=>{
 assert.match(ui,/fetch\('\/api\/owner-register-execution\?register='\+id/);
 assert.match(ui,/acceptanceExecutions=nextExecutions/);
 assert.match(ui,/exec\?\.decision==='accepted'/);
 assert.match(ui,/exec\?\.decision==='review_pending'/);
 assert.match(ui,/if\(acceptanceView==='accepted'\)return acceptedByOwner\(row\)/);
});
