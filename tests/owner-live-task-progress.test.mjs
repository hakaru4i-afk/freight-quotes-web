import test from 'node:test';
import assert from 'node:assert/strict';
import {TASK,summarize} from '../test/owner-live-task-progress-20261121.mjs';
import {readFileSync} from 'node:fs';
const HEAD='a'.repeat(40),OLD='b'.repeat(40),BRANCH='ci/sh59-verified-source-handoff-20261121';
function pr(){return {number:145,base:{ref:'main'},head:{ref:BRANCH,sha:HEAD,repo:{full_name:TASK.repo}}};}
function audit(){return {id:44802361801,path:'.github/workflows/sh59-protected-37-audit.yml',head_repository:{full_name:TASK.repo},status:'completed',conclusion:'success'};}
function run(name,{sha=HEAD,branch=BRANCH,conclusion='success',status='completed',id=123}={}){return {id,name,status,conclusion,head_sha:sha,head_branch:branch,head_repository:{full_name:TASK.repo},event:'pull_request',created_at:'2026-11-21T06:00:00Z',updated_at:'2026-11-21T06:00:01Z'};}
const names=['SH59 immutable tested-source handoff (staging only)','Release stabilization candidate','Canonical staging alignment'];
test('never creates 100% progress or a released state from old 37/37 alone',()=>{const x=summarize({pr:pr(),audit:audit(),runs:[]});assert.equal(x.passed,1);assert.equal(x.percent,17);assert.equal(x.releaseReady,false)});
test('only exact current PR SHA and branch count toward progress',()=>{const x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name,{sha:OLD}))});assert.equal(x.passed,1);assert.equal(x.state,'unverified')});
test('passing negative handoff tests does not claim staging parity or publication',()=>{const x=summarize({pr:pr(),audit:audit(),runs:names.map((name,i)=>run(name,{id:i+1}))});assert.equal(x.passed,4);assert.equal(x.percent,67);assert.equal(x.stages[4].passed,false);assert.equal(x.stages[5].passed,false)});
test('failed workflow keeps failure visible without treating it as a pass',()=>{const x=summarize({pr:pr(),audit:audit(),runs:[run(names[0]),run(names[1],{conclusion:'failure',id:122})]});assert.equal(x.passed,2);assert.equal(x.state,'failed');assert.match(x.action,/Ошибка GitHub Actions/)});
test('active GitHub job shows actual in-progress step, not fake Codex activity',()=>{const running=run(names[1],{status:'in_progress',conclusion:null,id:555});const x=summarize({pr:pr(),audit:audit(),runs:[running],job:{runId:555,name:'complete-regression',step:'Run frontend tests'}});assert.equal(x.state,'running');assert.match(x.action,/complete-regression \/ Run frontend tests/);assert.equal(x.runId,555)});
test('different repository or PR cannot be treated as verified release',()=>{const other=pr();other.head.repo.full_name='foreign/repo';const x=summarize({pr:other,audit:audit(),runs:names.map(name=>run(name))});assert.equal(x.passed,1);assert.equal(x.runUrl,null)});
test('failed or unverified E2E yields zero when no other proof exists',()=>{const bad=audit();bad.conclusion='failure';const x=summarize({pr:pr(),audit:bad,runs:[]});assert.equal(x.passed,0)});
test('production and test entrypoints both load scoped owner monitor with GitHub CSP',()=>{
 for(const path of ['index.html','test/index.html']){
  const html=readFileSync(path,'utf8');
  assert.match(html,/owner-live-task-progress-20261121\.mjs\?v=[a-f0-9]{12}/);
  assert.match(html,/owner-live-task-progress-20261121\.css\?v=[a-f0-9]{12}/);
  assert.match(html,/connect-src 'self' https:\/\/api\.github\.com/);
 }
});
test('monitor uses no private tokens, never submits mutations, only displays inside Owner cabinet',()=>{
 const code=readFileSync('test/owner-live-task-progress-20261121.mjs','utf8');
 assert.match(code,/data-cabinet-role="owner"/);
 assert.match(code,/credentials:'omit'/);
 assert.doesNotMatch(code,/service_role|Bearer |github_pat_|ghp_|localStorage|sessionStorage|method:\s*['"]POST['"]/);
 assert.match(code,/120000/);
});


function verifiedParity(){return {runtimePairStatus:'VERIFIED',frontendCommit:'6e0a465b2b031558989f62b38dc7939797434686',apiSourceCommit:'092decf57d97fabdefa35bba0593890f52d34ef6',apiBundleSha256:'2875f4dc43dcc61a8b191edcf70281d7f1b8875847bc9e0b276160bdfe6b0b87',qaEvidence:{fullGroupsPassed:37}};}
function verifiedPublication(){return {manifest:{environment:'production',businessVersion:'SH-01.30.59 v',sourceStagingFrontendCommit:'6e0a465b2b031558989f62b38dc7939797434686',frontendBuild:'locked-build',releaseId:'SH59-OWNER-APPROVED'},build:{environment:'production',releaseVersion:'SH-01.30.59 v',build:'locked-build'},release:{event:'workflow_dispatch',conclusion:'success',publishJob:true,backupRestoreVerified:true,ownerApproved:true,approvedReleaseId:'SH59-OWNER-APPROVED'},};}
test('published source, backend parity and protected Owner gate together permit 100% status',()=>{const x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name)),parity:verifiedParity(),publication:verifiedPublication()});assert.equal(x.percent,100);assert.equal(x.releaseReady,true)});
test('mismatched API bundle blocks verification and production completion',()=>{const parity=verifiedParity();parity.apiBundleSha256='f'.repeat(64);const x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name)),parity,publication:verifiedPublication()});assert.equal(x.percent,67);assert.equal(x.releaseReady,false)});
test('a successful PR release-negative-test is not a published owner-approved release',()=>{const publication=verifiedPublication();publication.release.publishJob=false;const x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name)),parity:verifiedParity(),publication});assert.equal(x.percent,83);assert.equal(x.releaseReady,false)});
test('out-of-date production release manifest never counts as deployed',()=>{const publication=verifiedPublication();publication.manifest.businessVersion='SH-01.30.52 v';const x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name)),parity:verifiedParity(),publication});assert.equal(x.percent,83);assert.equal(x.releaseReady,false)});


test('successful rerun on the same commit clears an obsolete failure in the live status',()=>{
 const old=run(names[1],{conclusion:'failure',id:11});
 const fresh=run(names[1],{conclusion:'success',id:12});fresh.created_at='2026-11-21T07:01:00Z';fresh.updated_at='2026-11-21T07:01:10Z';
 const x=summarize({pr:pr(),audit:audit(),runs:[old,fresh]});
 assert.equal(x.state,'checked');assert.equal(x.stages[2].passed,true);
});

test('publish job without verified restore and exact Owner release approval stays blocked',()=>{
 const publication=verifiedPublication();delete publication.release.backupRestoreVerified;
 let x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name)),parity:verifiedParity(),publication});
 assert.equal(x.releaseReady,false);
 publication.release.backupRestoreVerified=true;publication.release.approvedReleaseId='OTHER-RELEASE';
 x=summarize({pr:pr(),audit:audit(),runs:names.map(name=>run(name)),parity:verifiedParity(),publication});
 assert.equal(x.releaseReady,false);
});
