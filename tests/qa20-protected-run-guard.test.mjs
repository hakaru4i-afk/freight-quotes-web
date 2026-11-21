import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertSingleProtectedAttempt} from '../scripts/qa20-protected-run-guard.mjs';

const sha='1'.repeat(40);
const title='SH59 QA20 full';
const run=(id, overrides)=>({id,head_sha:sha,head_branch:'main',event:'workflow_dispatch',display_title:title,...overrides});
const input=()=>({id:102,attempt:1,sha,title,runs:[run(102)]});

test('accepts one full run and ignores separate fixture checks and other commits',()=>{
  const options=input();
  options.runs.push(run(100,{display_title:'SH59 QA20 fixture'}),run(101,{head_sha:'2'.repeat(40)}));
  assert.doesNotThrow(()=>assertSingleProtectedAttempt(options));
});

test('blocks a concurrent duplicate and a later duplicate after completion',()=>{
  for(const status of ['queued','in_progress','completed']){
    const options=input();
    options.runs.push(run(101,{status}));
    assert.throws(()=>assertSingleProtectedAttempt(options),/DUPLICATE_PROTECTED_DISPATCH/);
  }
});

test('permits exactly one owner rerun of the original failed attempt',()=>{
  const options={...input(),attempt:2,trigger:'hakaru4i-afk',previous:{id:102,head_sha:sha,run_attempt:1,conclusion:'failure'}};
  assert.doesNotThrow(()=>assertSingleProtectedAttempt(options));
  assert.throws(()=>assertSingleProtectedAttempt({...options,attempt:3}),/PROTECTED_RETRY_LIMIT/);
  assert.throws(()=>assertSingleProtectedAttempt({...options,trigger:'another-user'}),/PROTECTED_RETRY_REQUIRES_OWNER/);
  assert.throws(()=>assertSingleProtectedAttempt({...options,previous:{...options.previous,conclusion:'success'}}),/PROTECTED_RETRY_REQUIRES_FAILED_ATTEMPT/);
});
