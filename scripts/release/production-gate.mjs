import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const hex40=/^[0-9a-f]{40}$/;
const hex64=/^[0-9a-f]{64}$/;
export const parseReleaseVersion=value=>{const m=/^SH-(\d{2})\.(\d{2})\.(\d{2}) v$/.exec(value||'');return m?m.slice(1).map(Number):null;};
export function isNewerRelease(candidate,current){const a=parseReleaseVersion(candidate),b=parseReleaseVersion(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
const requiredIds=[...Array.from({length:11},(_,i)=>'T1-'+String(i+1).padStart(2,'0')),...Array.from({length:26},(_,i)=>'T2-'+String(i+1).padStart(2,'0'))];
const OWNER='hakaru4i-afk';
const WEB=OWNER+'/freight-quotes-web';
const BACKEND=OWNER+'/freight-quotes';
export function inspectProductionGate({context={},target={},manifest={},build={},stage={},runs={},reports={},ownerComment={}}={}) {
  const blockers=[];
  const check=(name,ok)=>{if(ok!==true)blockers.push(name)};
  check('MANUAL_OWNER_MAIN_ONLY',context.event==='workflow_dispatch'&&context.actor===OWNER&&context.ref==='refs/heads/main'&&context.repository===WEB);
  check('EXACT_SHA_AND_MAIN_HEAD',hex40.test(target.frontendSha||'')&&hex40.test(target.backendSha||'')&&context.checkoutSha===target.frontendSha&&context.mainSha===target.frontendSha);
  check('PRODUCTION_RELEASE_IDENTITY',Boolean(parseReleaseVersion(target.businessVersion))&&manifest.environment==='production'&&manifest.businessVersion===target.businessVersion&&build.environment==='production'&&build.releaseVersion===target.businessVersion&&stage.primaryBusinessVersion===target.businessVersion&&build.build===manifest.frontendBuild);
  check('PROVENANCE_PAIR',reports.pair?.frontendSha===target.frontendSha&&reports.pair?.backendSha===target.backendSha&&hex64.test(reports.pair?.apiBundleSha256||'')&&reports.pair?.servedFrontendSha===target.frontendSha&&reports.pair?.servedApiVerified===true);
  const requiredRuns={frontend:{repo:WEB,sha:target.frontendSha},backend:{repo:BACKEND,sha:target.backendSha},e2e:{repo:WEB,sha:null},recovery:{repo:BACKEND,sha:target.backendSha}};
  for(const [key,expected] of Object.entries(requiredRuns)){
    const run=runs[key];
    check('VERIFIED_GITHUB_RUN_'+key.toUpperCase(),Boolean(run&&Number.isSafeInteger(run.id)&&run.id>0&&run.repository===expected.repo&&run.status==='completed'&&run.conclusion==='success'&&hex40.test(run.head_sha||'')&&(!expected.sha||run.head_sha===expected.sha)&&run.event!=='pull_request_target'));
  }
  check('COMPLETE_REGRESSION_37',reports.regression?.frontendSha===target.frontendSha&&reports.regression?.result==='PASS'&&reports.regression?.groupCount===37&&reports.regression?.allTestsPassed===true);
  check('BACKEND_REGRESSION_AND_SECURITY',reports.backend?.backendSha===target.backendSha&&reports.backend?.result==='PASS'&&reports.backend?.rbacRls==='PASS'&&reports.backend?.schemaTransition==='PASS');
  const evidence=reports.e2e;
  const scenarios=Array.isArray(evidence?.scenarios)?evidence.scenarios:[];
  const found=new Map(scenarios.map(x=>[x.id,x]));
  const allPassed=scenarios.length===37&&found.size===37&&requiredIds.every(id=>{
    const x=found.get(id);
    return x&&x.status==='PASS'&&x.mode==='AUTHENTICATED_QA_API'&&typeof x.actorRole==='string'&&x.actorRole.length>0&&x.evidence?.method==='HTTP_AND_BROWSER'&&x.evidence?.responseVerified===true&&typeof x.evidence.traceId==='string'&&x.evidence.traceId.length>0;
  });
  check('AUTHORIZED_37_OF_37',evidence?.authorized===true&&evidence?.environment==='isolated-qa'&&evidence?.frontendSha===target.frontendSha&&evidence?.backendSha===target.backendSha&&Array.isArray(evidence.criticalDefects)&&evidence.criticalDefects.length===0&&allPassed);
  check('PRODUCTION_BACKUP',reports.backup?.result==='PASS'&&reports.backup?.source==='production'&&reports.backup?.encrypted===true&&reports.backup?.readbackSha256===true&&hex64.test(reports.backup?.sha256||'')&&reports.backup?.databaseCaptured===true&&reports.backup?.storageCaptured===true);
  check('INDEPENDENT_RESTORE_AND_ROLLBACK',reports.restore?.result==='PASS'&&reports.restore?.backendSha===target.backendSha&&reports.restore?.databaseRestored===true&&reports.restore?.storageRestored===true&&reports.restore?.isolationVerified===true&&reports.restore?.verifiedRollback===true&&reports.restore?.sourceBackupSha256===reports.backup?.sha256);
  const approvalText='APPROVE '+target.businessVersion+' FRONTEND='+target.frontendSha+' BACKEND='+target.backendSha;
  check('EXPLICIT_OWNER_APPROVAL',ownerComment?.user?.login===OWNER&&ownerComment?.body?.trim()===approvalText&&ownerComment?.created_at&&runs.e2e?.updated_at&&Date.parse(ownerComment.created_at)>=Date.parse(runs.e2e.updated_at)&&Number.isFinite(Date.parse(ownerComment.created_at)));
  return {allowed:blockers.length===0,status:blockers.length?'RELEASE_BLOCKED':'READY_FOR_MANUAL_PUBLICATION',blockers};
}

// CLI input must be assembled from trusted GitHub API and downloaded run artifacts.
// No caller-supplied JSON may itself authorize deployment.
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const file=process.argv[2];
  if(!file)throw Error('REQUIRED_GITHUB_VERIFIED_EVIDENCE_FILE');
  const result=inspectProductionGate(JSON.parse(readFileSync(file,'utf8')));
  console.log(JSON.stringify(result));
  if(!result.allowed)process.exitCode=1;
}
