// SH59 transfer gate. Produces a source-locked staging handoff, NEVER a production approval.
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const WEB='hakaru4i-afk/freight-quotes-web';
const REQUIRED=[...Array.from({length:11},(_,i)=>`T1-${String(i+1).padStart(2,'0')}`),...Array.from({length:26},(_,i)=>`T2-${String(i+1).padStart(2,'0')}`)];
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const passRun=(run,path)=>run?.repository?.full_name===WEB && run.path===path && run.status==='completed' && run.conclusion==='success' && run.head_branch==='main' && SHA40.test(run.head_sha||'') && Number.isSafeInteger(run.id) && run.id>0;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function validateTestedCandidate({audit,protectedRun,e2e,manifest,checkoutSha,sourceTreeSha,assetBytes}){
  assert.ok(passRun(audit,'.github/workflows/sh59-protected-37-audit.yml'),'UNVERIFIED_37_AUDIT_RUN');
  assert.ok(['workflow_dispatch','workflow_run'].includes(audit.event),'INVALID_AUDIT_TRIGGER');
  assert.ok(passRun(protectedRun,'.github/workflows/carrier124-main-oidc-smoke.yml'),'UNVERIFIED_PROTECTED_RUN');
  assert.equal(protectedRun.event,'workflow_dispatch','PROTECTED_RUN_MUST_USE_OIDC_DISPATCH');
  assert.equal(e2e.runId,protectedRun.id,'PROTECTED_EVIDENCE_RUN_MISMATCH');
  assert.ok(Date.parse(audit.updated_at)>Date.parse(protectedRun.updated_at),'AUDIT_MUST_FOLLOW_E2E');
  assert.equal(e2e.environment,'isolated-qa');
  assert.equal(e2e.authorized,true,'AUTHENTICATION_NOT_VERIFIED');
  assert.equal(manifest.primaryBusinessVersion,'SH-01.30.59 v');
  assert.equal(e2e.frontendSha,checkoutSha,'DIFFERENT_FROM_TESTED_FRONTEND_SOURCE');
  assert.match(checkoutSha||'',SHA40,'INVALID_CHECKOUT_SHA');
  assert.match(sourceTreeSha||'',SHA40,'INVALID_TEST_TREE_SHA');
  assert.equal(e2e.frontendSource,manifest.frontendCommit,'FRONTEND_SOURCE_PROVENANCE_MISMATCH');
  assert.equal(manifest.sh59IsolatedQa?.businessVersion,'SH-01.30.59 v');
  assert.equal(manifest.sh59IsolatedQa?.version,20,'API_NOT_TESTED_V20');
  assert.equal(e2e.backendVersion,20,'E2E_API_NOT_V20');
  assert.equal(manifest.sh59IsolatedQa?.sourceCommit,manifest.backendSourceCommit,'UNVERIFIED_BACKEND_ORIGIN');
  assert.equal(e2e.backendSha,manifest.sh59IsolatedQa?.sourceCommit,'TESTED_BACKEND_SHA_MISMATCH');
  assert.match(e2e.backendSha||'',SHA40,'INVALID_BACKEND_SHA');
  assert.equal(e2e.backendBundle,manifest.sh59IsolatedQa?.providerBundleSha256,'TESTED_API_BUNDLE_MISMATCH');
  assert.match(e2e.backendBundle||'',SHA64,'INVALID_API_BUNDLE_SHA');
  assert.equal(e2e.qaCredentialsRevoked,11,'SYNTHETIC_SESSIONS_NOT_CLOSED');
  assert.deepEqual(e2e.criticalDefects,[],'OPEN_CRITICAL_DEFECTS');
  assert.ok(Array.isArray(e2e.scenarios)&&e2e.scenarios.length===37,'NOT_37_E2E');
  assert.deepEqual(e2e.scenarios.map(s=>s.id).sort(),[...REQUIRED].sort(),'E2E_ID_MISMATCH');
  assert.ok(e2e.scenarios.every(s=>s.status==='PASS'&&s.mode==='AUTHENTICATED_QA_API'&&s.actorRole&&s.evidence?.method==='HTTP_AND_BROWSER'&&s.evidence?.responseVerified===true&&s.evidence?.traceId),'E2E_EVIDENCE_INCOMPLETE');
  for(const name of ['test/index.html','test/app.js','test/staging-manifest.json'])assert.ok(assetBytes?.[name]&&assetBytes[name].length>0,'MISSING_TESTED_ASSET:'+name);
  return Object.freeze({
    schemaVersion:1,
    state:'TESTED_SOURCE_HANDOFF_NOT_DEPLOYED',
    businessVersion:'SH-01.30.59 v',
    frontendSha:checkoutSha,
    frontendTestTreeSha:sourceTreeSha,
    backendSha:e2e.backendSha,
    apiVersion:e2e.backendVersion,
    apiBundleSha256:e2e.backendBundle,
    auditRunId:audit.id,
    protectedRunId:protectedRun.id,
    verifiedScenarios:37,
    assets:Object.fromEntries(Object.entries(assetBytes).map(([name,bytes])=>[name,hash(bytes)])),
    productionAuthorized:false,
    sharedStagingApiParityVerified:false,
    freshProductionBackupVerified:false,
    independentProductionRestoreVerified:false,
    requiresExplicitOwnerApproval:true
  });
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [auditPath,protectedPath,e2ePath,outPath]=process.argv.slice(2);
  if(!auditPath||!protectedPath||!e2ePath||!outPath)throw Error('USAGE: prepare-tested-candidate.mjs audit.json protected-run.json e2e.json outdir');
  const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
  const manifest=readJson('test/staging-manifest.json');
  const checkoutSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const sourceTreeSha=execFileSync('git',['rev-parse','HEAD:test'],{encoding:'utf8'}).trim();
  const tracked=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();
  assert.equal(tracked,'','UNCOMMITTED_SOURCE_FILES');
  const sourceManifest=JSON.parse(execFileSync('git',['show','HEAD:test/staging-manifest.json'],{encoding:'utf8'}));
  assert.deepEqual(sourceManifest,manifest,'CHECKOUT_MANIFEST_MISMATCH');
  const assetBytes=Object.fromEntries(['test/index.html','test/app.js','test/staging-manifest.json'].map(name=>[name,readFileSync(name)]));
  const lock=validateTestedCandidate({audit:readJson(auditPath),protectedRun:readJson(protectedPath),e2e:readJson(e2ePath),manifest,checkoutSha,sourceTreeSha,assetBytes});
  mkdirSync(outPath,{recursive:true});
  writeFileSync(resolve(outPath,'sh59-tested-source-lock.json'),JSON.stringify(lock,null,2)+'\n',{mode:0o600});
  console.log('SH59_EXACT_TESTED_SOURCE_LOCKED',checkoutSha,'API',lock.apiVersion,'E2E',lock.verifiedScenarios);
  console.log('STAGING_IMPORT_ONLY; PRODUCTION_UNCHANGED; RELEASE_REMAINS_BLOCKED');
}
