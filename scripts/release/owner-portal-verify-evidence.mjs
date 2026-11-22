// GitHub is the source of CI truth. Private evidence is checked by content and exact SHA.
// Never infer a PASS from a successful workflow shell or a stale artifact.
import{execFileSync}from'node:child_process';
import{mkdtempSync,readdirSync,readFileSync,statSync,rmSync}from'node:fs';
import{join}from'node:path';
import{tmpdir}from'node:os';
const WEB='hakaru4i-afk/freight-quotes-web',BE='hakaru4i-afk/freight-quotes';
const webSha=process.env.FRONTEND_SHA||'',beSha=process.env.BACKEND_SHA||'',wt=process.env.GITHUB_WEB_TOKEN||'',bt=process.env.GITHUB_BACKEND_TOKEN||'';
const sha=/^[a-f0-9]{40}$/;
if(!sha.test(webSha)||!sha.test(beSha)||!wt||!bt)throw Error('RELEASE_EVIDENCE_IDENTITY_OR_TOKEN_MISSING');
const get=async(repo,path,token)=>{
 const r=await fetch('https://api.github.com/repos/'+repo+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('GITHUB_EVIDENCE_FETCH_FAILED '+repo+' '+r.status);
 return await r.json();
};
const [fc,bc]=await Promise.all([get(WEB,'/commits/'+webSha+'/check-runs?per_page=100',wt),get(BE,'/commits/'+beSha+'/check-runs?per_page=100',bt)]);
if(fc.total_count>100||bc.total_count>100)throw Error('INCOMPLETE_GITHUB_CHECK_LIST');
const passed=(data,name,sha)=>data.check_runs?.filter(x=>x.name===name&&x.head_sha===sha&&x.status==='completed'&&x.conclusion==='success').length===1;
// The same protected workflow runs its full frontend suite on this exact SHA.
// A separate main-commit task-e2e check is optional because task-e2e is PR-only.
const taskChecks=(fc.check_runs||[]).filter(r=>r.name==='task-e2e'&&r.head_sha===webSha);
if(taskChecks.length&&!passed(fc,'task-e2e',webSha))throw Error('FRONTEND_EXACT_SHA_TASK_E2E_FAILED');
if(!passed(bc,'canonical',beSha))throw Error('BACKEND_EXACT_SHA_CANONICAL_NOT_PASS');
const now=Date.now();
const recent=r=>r?.status==='completed'&&r.conclusion==='success'&&now-Date.parse(r.updated_at||'')<24*60*60*1000;
const latest=async(repo,token,sha,name)=>{
 const data=await get(repo,'/actions/runs?head_sha='+sha+'&per_page=100',token);
 if(data.total_count>100)throw Error('GITHUB_EVIDENCE_RUN_LIST_INCOMPLETE:'+name);
 return (data.workflow_runs||[]).find(r=>r.name===name&&r.head_sha===sha&&recent(r)&&r.event!=='pull_request_target');
};
const qa=await latest(WEB,wt,webSha,'Carrier124 live OIDC acceptance on isolated SH59 (11 roles)');
if(!qa)throw Error('FRESH_AUTHENTICATED_37_E2E_MISSING_FOR_EXACT_FRONTEND_SHA');
const backup=await latest(BE,bt,beSha,'Issue 29 - encrypted production backup to Google Drive');
if(!backup)throw Error('FRESH_PRODUCTION_BACKUP_MISSING_FOR_EXACT_BACKEND_SHA');
const restore=await latest(BE,bt,beSha,'Issue29 Mac independent recovery safety');
if(!restore)throw Error('FRESH_INDEPENDENT_RESTORE_MISSING_FOR_EXACT_BACKEND_SHA');
const temp=mkdtempSync(join(tmpdir(),'owner-release-evidence-'));
function walk(dir){
 return readdirSync(dir).flatMap(name=>{const path=join(dir,name),s=statSync(path);return s.isDirectory()?walk(path):[path]});
}
function artifact({repo,id,name,token,path}){
 const target=join(temp,path);
 const {mkdirSync}=requireFs;
 mkdirSync(target,{recursive:true});
 execFileSync('gh',['run','download',String(id),'-R',repo,'--name',name,'--dir',target],{env:{...process.env,GH_TOKEN:token},stdio:['ignore','pipe','pipe'],timeout:120000});
 return target;
}
const requireFs=await import('node:fs');
function exactEvidence(dir,file){
 const found=walk(dir).filter(p=>p.endsWith('/'+file));
 if(found.length!==1)throw Error('REQUIRED_TRUSTED_RELEASE_PROOF_MISSING:'+file);
 return JSON.parse(readFileSync(found[0],'utf8'));
}
try{
 const e2eDir=artifact({repo:WEB,id:qa.id,name:'carrier124-oidc-sh59-redacted-evidence',token:wt,path:'e2e'});
 const backupDir=artifact({repo:BE,id:backup.id,name:'sh59-production-recovery-receipt',token:bt,path:'backup'});
 const restoreDir=artifact({repo:BE,id:restore.id,name:'issue29-independent-restore-evidence',token:bt,path:'restore'});
 const e2e=exactEvidence(e2eDir,'private-authenticated-e2e.json');
 const b=exactEvidence(backupDir,'private-production-backup-evidence.json');
 const r=exactEvidence(restoreDir,'private-restore-evidence.json');
 const rows=e2e.scenarios||[];
 if(e2e.authorized!==true||e2e.frontendSha!==webSha||e2e.backendSha!==beSha||rows.length!==37||new Set(rows.map(x=>x.id)).size!==37||
  rows.some(x=>x.status!=='PASS'||x.mode!=='AUTHENTICATED_QA_API'||x.evidence?.responseVerified!==true))
  throw Error('AUTHENTICATED_37_E2E_NOT_VERIFIED_FOR_CURRENT_PAIR');
 if(b.result!=='PASS'||b.source!=='production'||b.databaseCaptured!==true||b.storageCaptured!==true||b.encrypted!==true||b.readbackSha256!==true||!/^([a-f0-9]{64})$/.test(b.sha256||''))
  throw Error('REAL_PRODUCTION_BACKUP_NOT_VERIFIED');
 if(r.result!=='PASS'||r.backendSha!==beSha||r.databaseRestored!==true||r.storageRestored!==true||r.isolationVerified!==true||r.verifiedRollback!==true||r.sourceBackupSha256!==b.sha256)
  throw Error('INDEPENDENT_BACKUP_RESTORE_NOT_VERIFIED');
 console.log('EXACT_SHA_CI_37_AUTH_E2E_BACKUP_RESTORE_VERIFIED',webSha,beSha,qa.id,backup.id,restore.id);
}finally{rmSync(temp,{force:true,recursive:true})}
