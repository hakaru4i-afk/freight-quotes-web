import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function assertSingleProtectedAttempt({runs, id, attempt, sha, title, trigger, previous}) {
  assert.ok(Number.isSafeInteger(id) && id > 0, 'INVALID_PROTECTED_RUN_ID');
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.match(title, /^SH59 QA20 (fixture|full|smoke)$/);
  const matching = runs.filter(run => run.head_sha === sha && run.head_branch === 'main' &&
    run.event === 'workflow_dispatch' && run.display_title === title);
  assert.equal(matching.filter(run => run.id === id).length, 1, 'PROTECTED_DISPATCH_NOT_VERIFIED');
  assert.ok(!matching.some(run => run.id < id), 'DUPLICATE_PROTECTED_DISPATCH_FOR_SHA_AND_MODE');
  if (attempt !== 1) {
    assert.equal(attempt, 2, 'PROTECTED_RETRY_LIMIT');
    assert.equal(trigger, 'hakaru4i-afk', 'PROTECTED_RETRY_REQUIRES_OWNER');
    assert.deepEqual([previous?.id, previous?.head_sha, previous?.run_attempt, previous?.conclusion],
      [id, sha, 1, 'failure'], 'PROTECTED_RETRY_REQUIRES_FAILED_ATTEMPT');
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [list, prior] = process.argv.slice(2);
  const pages = JSON.parse(readFileSync(list));
  assert.ok(Array.isArray(pages) && pages.length > 0, 'MISSING_ACTIONS_RUNS');
  assertSingleProtectedAttempt({
    runs:pages.flatMap(page => page.workflow_runs),
    id:Number(process.env.GITHUB_RUN_ID), attempt:Number(process.env.GITHUB_RUN_ATTEMPT),
    sha:process.env.GITHUB_SHA, title:process.env.QA_RUN_TITLE, trigger:process.env.GITHUB_TRIGGERING_ACTOR,
    previous:prior ? JSON.parse(readFileSync(prior)) : null
  });
  console.log('PROTECTED_SINGLE_RUN_GUARD_PASS', process.env.GITHUB_RUN_ID);
}
