import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const live=readFileSync('portal-feedback-center-20261107.js','utf8');
const stage=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const workflow=readFileSync('.github/workflows/owner-portal-release.yml','utf8');
test('one visible release button and exactly matching UI for production and staging',()=>{
 assert.equal(live,stage);
 assert.equal(live,candidate);
 assert.ok(live.includes('data-pf="release-update"'));
 assert.ok(!live.includes('data-pf="prepare-release"'));
});
test('Owner can release after verified task progress reaches 100%',()=>{
 const gate=live.split('\n').find(s=>s.startsWith('const isReleaseReady='));
 assert.ok(gate.includes("isOwner===true"));
 assert.ok(gate.includes("execution?.progress===100"));
 assert.ok(gate.includes("execution?.checksPassed===true"));
 assert.ok(!gate.includes('readiness?.passed===4'));
 assert.ok(live.includes("!releaseReady||isRunning||isConfirmed||busy?'disabled':''"));
 assert.ok(live.includes("action:'release_update'"));
});
test('protected Mac release runs only on Owner dispatch with quick checks, API and Pages',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.match(workflow,/github.actor == 'hakaru4i-afk'/);
 assert.match(workflow,/runs-on: \[self-hosted, macOS, ARM64, freight-mac-qa\]/);
 assert.match(workflow,/node --check portal-feedback-center-20261107\.js/);
 assert.doesNotMatch(workflow,/node scripts\/release\/owner-portal-verify-evidence\.mjs/);
 assert.match(workflow,/supabase functions deploy freight-api/);
 assert.match(workflow,/actions\/deploy-pages@v4/);
});
test('deep browser tests can be run manually but do not run for ordinary pushes',()=>{
 const deep=readFileSync('.github/workflows/owner-main-e2e.yml','utf8');
 assert.doesNotMatch(deep,/^  push:/m);
 assert.match(deep,/workflow_dispatch:/);
});
test('cabinet help is available in RU EN ZH, and builder packages the checked candidate',()=>{
 for(const locale of ["ru:{","en:{","zh:{"])assert.ok(live.includes(locale));
 assert.match(live,/Бэкапы и E2E отдельно/);
 assert.match(readFileSync('scripts/release/owner-portal-pages.mjs','utf8'),/release\/owner-portal-feedback-center-20261122\.js/);
});
