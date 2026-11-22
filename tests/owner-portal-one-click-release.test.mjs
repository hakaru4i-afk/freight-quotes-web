import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
const root=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
test('production and staging center modules are byte-identical',()=>assert.equal(root,stage));
test('release button starts verified Owner command without waiting for test results',()=>{
 assert.match(root,/data-pf="release-update"/);
 assert.match(root,/if\(data\.owner&&item&&\['in_progress','release'\]\.includes\(item\.status\)&&!busy\)/);
 assert.doesNotMatch(root,/data-pf="release-update"[^\n]+!releaseReady\|\|busy/);
 assert.match(root,/action:'release_update'/);
});
test('release state must come from protected backend and be visible',()=>{
 assert.match(root,/\?releaseProgress=/);
 assert.match(root,/releaseRun=body\.release/);
 assert.match(root,/releaseT\(\)\.queued/);
 assert.match(root,/https:\\\/\\\/github/);
});
test('localized release action and state in RU, EN and ZH',()=>{
 for(const locale of ['ru','en','zh'])assert.match(root,new RegExp(locale+':\\{title:'));
});
