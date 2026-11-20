import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleBranch} from '../scripts/ops/prune-merged-branches.mjs';
const old='2026-10-01T12:00:00Z',now=new Date('2026-11-20T08:00:00Z');
const base={name:'ci/old-merged',protectedBranch:false,openPR:false,aheadBy:0,latestCommit:old,defaultBranch:'main',now};
test('fully merged old temporary branch can be pruned',()=>assert.equal(eligibleBranch(base),true));
test('do not delete open PR heads',()=>assert.equal(eligibleBranch({...base,openPR:true}),false));
test('do not delete anything ahead of main (unmerged work)',()=>assert.equal(eligibleBranch({...base,aheadBy:1}),false));
test('do not delete release, recovery, QA, backup, docs, current work or protected refs',()=>{
 for(const name of ['main','release/1.19.2','recovery/production-v46','qa/carrier124','ops/issue29-backup','docs/approved-process','hotfix/security','fix/carrier-dashboard-124']){
  assert.equal(eligibleBranch({...base,name}),false,name);
 }
 assert.equal(eligibleBranch({...base,protectedBranch:true}),false);
});
test('do not delete newly updated branch',()=>assert.equal(eligibleBranch({...base,latestCommit:'2026-11-19T08:00:00Z'}),false));
test('branch must have an exact merged ahead count and valid commit date',()=>{
 assert.equal(eligibleBranch({...base,aheadBy:null}),false);
 assert.equal(eligibleBranch({...base,latestCommit:null}),false);
});
