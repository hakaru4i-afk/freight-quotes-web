import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const live=readFileSync('release/owner-portal-feedback-center-20261122.js','utf8');
const testCopy=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const gate=live.match(/const isReleaseReady=.*?;\n/);
test('Pages candidate and staging share one release gate',()=>assert.equal(live,testCopy));
test('Owner-only gate requires confirmed 100 percent work, not backup or SHA certificates',()=>{
 assert.ok(gate);
 const ctx={};runInNewContext(gate[0]+'\nglobalThis.ready=isReleaseReady;',ctx);
 const item={id:'id',status:'release'},done={step:'ready_for_review',checksPassed:true};
 assert.equal(ctx.ready(item,true,null,done),true);
 for(const a of [
 [item,false,null,done],
 [item,true,null,{step:'branch_awaiting_codex',checksPassed:false}],
 [item,true,null,{step:'codex_writing',checksPassed:true}],
 [item,true,null,{step:'ready_for_review',checksPassed:false}],
 [{...item,status:'completed'},true,null,done]
 ])assert.equal(ctx.ready(...a),false);
});
test('one button starts protected release, no separate preflight control',()=>{
 assert.ok(live.includes('data-pf="release-update"'));
 assert.ok(live.includes("action:'release_update'"));
 assert.ok(!live.includes('data-pf="prepare-release"'));
});
