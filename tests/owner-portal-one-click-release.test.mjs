import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const live=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const builder=readFileSync('scripts/release/owner-portal-pages.mjs','utf8');
test('active root and staging remain identical until a verified production promotion',()=>{
 assert.equal(live,stage);
 assert.notEqual(candidate,live);
 assert.match(live,/if\(isReleaseReady\(item,data\.owner,releaseReadiness\)&&!busy\)/);
});
test('release candidate button starts Owner command without waiting for prior tests',()=>{
 assert.match(candidate,/data-pf="release-update"/);
 assert.match(candidate,/if\(data\.owner&&item&&\['in_progress','release'\]\.includes\(item\.status\)&&!busy\)/);
 assert.match(candidate,/action:'release_update'/);
 assert.doesNotMatch(candidate,/data-pf="release-update"[^\n]+!releaseReady\|\|busy/);
});
test('candidate receives protected server job state and displays milestones',()=>{
 assert.match(candidate,/\?releaseProgress=/);
 assert.match(candidate,/releaseRun=body\.release/);
 assert.match(candidate,/releaseT\(\)\.queued/);
 assert.match(candidate,/actionUrl/);
 assert.match(candidate,/runState\.progress/);
});
test('candidate has RU, EN and ZH rollout guidance',()=>{
 for(const locale of ['ru','en','zh'])assert.match(candidate,new RegExp(locale+':\\{title:'));
});
test('only the protected Pages release builder promotes candidate bytes',()=>{
 assert.match(builder,/release\/owner-portal-feedback-center-20261122\.js/);
 assert.match(builder,/portal-feedback-center-20261107\.js/);
 assert.match(builder,/OWNER_RELEASE_CANDIDATE_MISSING/);
});
