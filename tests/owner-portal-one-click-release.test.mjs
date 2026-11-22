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
 assert.match(live,/if\(isReleaseReady\(item,data\.owner,releaseReadiness,executionByFeedback\.get\(item\?\.id\)\)&&!busy\)/);
});
test('release candidate button waits for 100% and 4 out of 4 checks',()=>{
 assert.match(candidate,/data-pf="release-update"/);
 assert.match(candidate,/if\(isReleaseReady\(item,data\.owner,releaseReadiness,executionByFeedback\.get\(item\?\.id\)\)&&!busy\)/);
 assert.match(candidate,/action:'release_update'/);
 assert.match(candidate,/!releaseReady\|\|isRunning\|\|isConfirmed\|\|busy/);
 assert.match(candidate,/execution\?\.progress===100&&execution\?\.checksPassed===true/);
 assert.match(candidate,/readiness\?\.passed===4&&readiness\?\.total===4/);
});
test('release hint counts four stage groups rather than raw individual CI jobs',()=>{
 assert.match(candidate,/const kinds=\['frontend','backend','e2e','recovery'\]/);
 assert.match(candidate,/stage\.length>0&&stage\.every\(x=>x\.pass===true\)/);
 assert.match(candidate,/passed,total:4/);
 assert.match(candidate,/releaseT\(\)\.testsSummary\+': '\+testsPassed\+'\/4'/);
 assert.match(candidate,/!releaseReady\|\|isRunning\|\|isConfirmed\|\|busy\?'disabled':''/);
});
test('100% task progress is distinct from release check evidence, with reason shown',()=>{
 assert.match(candidate,/progressValue===100\?releaseT\(\)\.devComplete/);
 assert.match(candidate,/runState\.status==='not_started'&&!releaseReady\?lines\.blocked/);
 assert.match(candidate,/const readinessReasonKeys=\{/);
 assert.match(candidate,/candidateMissing:'Кандидат выпуска не привязан/);
 assert.match(candidate,/reason:result\.reason\|\|''/);
 assert.match(candidate,/releaseReason\(\)/);
 assert.match(candidate,/!releaseReady\|\|isRunning\|\|isConfirmed\|\|busy\?'disabled':''/);
});
test('100% development can run task-pinned preflight without bypassing release guard',()=>{
 assert.match(candidate,/execution\?\.progress===100&&execution\?\.checksPassed===true&&!releaseReady/);
 assert.match(candidate,/data-pf="prepare-release"/);
 assert.match(candidate,/action:'prepare_release'/);
 assert.match(candidate,/preflightQueued/);
 assert.match(candidate,/!releaseReady\|\|isRunning\|\|isConfirmed\|\|busy\?'disabled':''/);
 for(const locale of ['ru','en','zh'])assert.ok(candidate.includes(locale+':{prepare:'));
});
test('candidate receives protected server job state and displays milestones',()=>{
 assert.match(candidate,/\?releaseProgress=/);
 assert.match(candidate,/releaseRun=body\.release/);
 assert.match(candidate,/releaseT\(\)\.queued/);
 assert.match(candidate,/actionUrl/);
 assert.match(candidate,/runState\.progress/);
});
test('candidate has RU, EN and ZH rollout guidance',()=>{
 for(const locale of ['ru','en','zh'])assert.ok(candidate.includes(locale+':{prepare:')&&candidate.includes('testsSummary:'),'missing localized gate for '+locale);
});
test('only the protected Pages release builder promotes candidate bytes',()=>{
 assert.match(builder,/release\/owner-portal-feedback-center-20261122\.js/);
 assert.match(builder,/portal-feedback-center-20261107\.js/);
 assert.match(builder,/OWNER_RELEASE_CANDIDATE_MISSING/);
});

test('release E2E uses latest successful automatic main run in 24 hours',()=>{
 const evidence=readFileSync('scripts/release/owner-portal-verify-evidence-frontend.mjs','utf8');
 assert.match(evidence,/owner-main-e2e\.yml\/runs\?branch=main/);
 assert.match(evidence,/latest\.status!=='completed'/);
 assert.match(evidence,/latest\.conclusion!=='success'/);
 assert.match(evidence,/age>=86400000/);
 assert.doesNotMatch(evidence,/EXACT_FRONTEND_SHA/);
 const actions=readFileSync('.github/workflows/owner-main-e2e.yml','utf8');
 assert.match(actions,/push:/);
 assert.match(actions,/branches: \[main\]/);
 assert.match(actions,/owner-ui-unification-browser\.test\.mjs/);
});
test('release integrates verified E2E and fresh backup, not exact SHA artifacts',()=>{
 const evidence=readFileSync('scripts/release/owner-portal-verify-evidence.mjs','utf8');
 assert.match(evidence,/owner-portal-verify-evidence-frontend\.mjs/);
 assert.match(evidence,/owner-portal-verify-evidence-backend\.mjs/);
 assert.doesNotMatch(evidence,/check-runs\?per_page=100/);
});
test('Owner may start protected workflow without typing UUIDs, and API deploy stays gated',()=>{
 const workflow=readFileSync('.github/workflows/owner-portal-release.yml','utf8');
 assert.match(workflow,/TASK_ID=\$\(cat \/proc\/sys\/kernel\/random\/uuid\)/);
 assert.match(workflow,/REQUEST_ID=\$\(cat \/proc\/sys\/kernel\/random\/uuid\)/);
 assert.match(workflow,/supabase functions deploy freight-api --project-ref ooclsrndeygojtofuyte --no-verify-jwt/);
 assert.match(workflow,/needs: verify/);
 assert.match(workflow,/Verify recent main browser E2E and fresh encrypted production backup before release/);
 assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'Merge pull request #168 '\)/);
});
