import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTestedCandidate} from '../scripts/release/prepare-tested-candidate.mjs';
const frontend='a'.repeat(40),backend='b'.repeat(40),bundle='c'.repeat(64),source='d'.repeat(40);
const scenarioIds=[...Array.from({length:11},(_,i)=>`T1-${String(i+1).padStart(2,'0')}`),...Array.from({length:26},(_,i)=>`T2-${String(i+1).padStart(2,'0')}`)];
function valid(){
const run=(id,path,when)=>({id,path,repository:{full_name:'hakaru4i-afk/freight-quotes-web'},status:'completed',conclusion:'success',head_branch:'main',head_sha:'e'.repeat(40),event:'workflow_dispatch',updated_at:when});
return {audit:{...run(77,'.github/workflows/sh59-protected-37-audit.yml','2026-11-20T20:00:00Z'),event:'workflow_run'},protectedRun:run(66,'.github/workflows/carrier124-main-oidc-smoke.yml','2026-11-20T19:00:00Z'),e2e:{runId:66,environment:'isolated-qa',authorized:true,frontendSha:frontend,frontendSource:source,backendSha:backend,backendVersion:20,backendBundle:bundle,qaCredentialsRevoked:11,criticalDefects:[],scenarios:scenarioIds.map(id=>({id,status:'PASS',mode:'AUTHENTICATED_QA_API',actorRole:'owner',evidence:{method:'HTTP_AND_BROWSER',responseVerified:true,traceId:id}}))},manifest:{primaryBusinessVersion:'SH-01.30.59 v',frontendCommit:source,backendSourceCommit:backend,sh59IsolatedQa:{businessVersion:'SH-01.30.59 v',sourceCommit:backend,version:20,providerBundleSha256:bundle}},checkoutSha:frontend,sourceTreeSha:'f'.repeat(40),assetBytes:{'test/index.html':Buffer.from('one'),'test/app.js':Buffer.from('two'),'test/staging-manifest.json':Buffer.from('three')}};
}
test('verified source yields staging-only handoff (never authorizes release)',()=>{const x=validateTestedCandidate(valid());assert.equal(x.verifiedScenarios,37);assert.equal(x.frontendSha,frontend);assert.equal(x.apiVersion,20);assert.equal(x.productionAuthorized,false);assert.equal(x.sharedStagingApiParityVerified,false)});
test('signed E2E run ID can be decimal text but must match GitHub run',()=>{const x=valid();x.e2e.runId='66';assert.equal(validateTestedCandidate(x).protectedRunId,66)});
test('non-numeric run ID remains rejected',()=>{const x=valid();x.e2e.runId='66evil';assert.throws(()=>validateTestedCandidate(x),/INVALID_EVIDENCE_RUN_ID/) });
test('different checkout SHA is rejected, even with 37 PASS',()=>{const x=valid();x.checkoutSha='9'.repeat(40);assert.throws(()=>validateTestedCandidate(x),/DIFFERENT_FROM_TESTED_FRONTEND_SOURCE/)});
test('different backend bundle is rejected',()=>{const x=valid();x.e2e.backendBundle='f'.repeat(64);assert.throws(()=>validateTestedCandidate(x),/TESTED_API_BUNDLE_MISMATCH/)});
test('missing or mocked scenario is rejected',()=>{const x=valid();x.e2e.scenarios[0].mode='MOCK';assert.throws(()=>validateTestedCandidate(x),/E2E_EVIDENCE_INCOMPLETE/)});
test('missing actor cleanup is rejected',()=>{const x=valid();x.e2e.qaCredentialsRevoked=10;assert.throws(()=>validateTestedCandidate(x),/SYNTHETIC_SESSIONS_NOT_CLOSED/)});
test('failed audit is rejected',()=>{const x=valid();x.audit.conclusion='failure';assert.throws(()=>validateTestedCandidate(x),/UNVERIFIED_37_AUDIT_RUN/)});
test('protected run ID cannot be substituted',()=>{const x=valid();x.e2e.runId=111;assert.throws(()=>validateTestedCandidate(x),/PROTECTED_EVIDENCE_RUN_MISMATCH/)});
test('missing source asset is rejected',()=>{const x=valid();delete x.assetBytes['test/index.html'];assert.throws(()=>validateTestedCandidate(x),/MISSING_TESTED_ASSET/)});
