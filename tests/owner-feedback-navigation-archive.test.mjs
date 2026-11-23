import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const registers=readFileSync('owner-registers-20261111.js','utf8');
const center=readFileSync('portal-feedback-center-20261107.js','utf8');
test('Owner links open the exact transferred task',()=>{
 assert.doesNotThrow(()=>new Function(registers));
 for(const marker of ['openFeedbackItem(execution?.feedbackId||job?.id)','openFeedbackItem(execution?.feedbackId||job.id)','openFeedbackItem(acceptanceExecutionFor(row)?.feedbackId||job.id)','openFeedbackItem(item.id)'])assert.ok(registers.includes(marker),marker);
 assert.match(registers,/url\.searchParams\.set\('feedbackTask',String\(feedbackId\)\)/);
});
test('Improvement Center selects archived tasks from deep links',()=>{
 assert.doesNotThrow(()=>new Function(center));
 assert.match(center,/const targeted=applyFeedbackTarget\(\)/);
 assert.match(center,/selected=item\.id;/);
 assert.match(center,/statusFilter=\['completed','denied'\]\.includes\(item\.status\)\?'archive':'active'/);
 assert.match(center,/window\.addEventListener\('portal-feedback-target-changed',syncFeedbackTarget\)/);
});
test('Verified completed status wins over historic GitHub error',()=>{
 assert.match(center,/execution\?\.publicationVerified===true&&execution\?\.step==='stored'/);
 assert.match(center,/Завершено и архивировано · публикация подтверждена/);
 assert.match(center,/item\.status!=='completed'&&execution\.lastError/);
 assert.match(center,/Подтверждение публикации/);
 assert.match(center,/Исторический запуск GitHub/);
});
