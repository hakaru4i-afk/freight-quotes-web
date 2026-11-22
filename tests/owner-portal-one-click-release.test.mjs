import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const live=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const builder=readFileSync('scripts/release/owner-portal-pages.mjs','utf8');
test('portal and staging expose the approved one-click release action',()=>{
 assert.equal(live,stage);
 assert.equal(live,candidate);
 assert.match(live,/if\(data\.owner&&item&&\['in_progress','release'\]\.includes\(item\.status\)&&!busy\)/);
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

test('release evidence freshness rejects future and invalid workflow timestamps',()=>{
 const evidence=readFileSync('scripts/release/owner-portal-verify-evidence.mjs','utf8');
 assert.match(evidence,/Number\.isFinite\(age\)&&age>=0&&age<24\*60\*60\*1000/);
 assert.match(evidence,/FRESH_PRODUCTION_BACKUP_MISSING_FOR_EXACT_BACKEND_SHA/);
 assert.match(evidence,/INDEPENDENT_BACKUP_RESTORE_NOT_VERIFIED/);
});

test('release evidence cannot reuse an older PASS after a newer failed or running exact-SHA run',()=>{
 const evidence=readFileSync('scripts/release/owner-portal-verify-evidence.mjs','utf8');
 assert.match(evidence,/candidates\.sort\(/);
 assert.match(evidence,/const newest=candidates\[0\]/);
 assert.match(evidence,/!newest\|\|!recent\(newest\)/);
 assert.match(evidence,/LATEST_EXACT_SHA_EVIDENCE_NOT_SUCCESS/);
 assert.doesNotMatch(evidence,/\.find\(r=>r\.name===name&&r\.head_sha===sha&&recent\(r\)/);
});

test('Owner may start protected workflow without typing UUIDs, and API deploy stays gated',()=>{
 const workflow=readFileSync('.github/workflows/owner-portal-release.yml','utf8');
 assert.match(workflow,/TASK_ID=\$\(cat \/proc\/sys\/kernel\/random\/uuid\)/);
 assert.match(workflow,/REQUEST_ID=\$\(cat \/proc\/sys\/kernel\/random\/uuid\)/);
 assert.match(workflow,/supabase functions deploy freight-api --project-ref ooclsrndeygojtofuyte --no-verify-jwt/);
 assert.match(workflow,/needs: verify/);
 assert.match(workflow,/Verify independent authenticated E2E and fresh production restore before release/);
 assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'Merge pull request #168 '\)/);
});
