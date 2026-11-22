// Inspect only frontend-owned, exact-SHA, independently authenticated 37-case evidence.
// Cross-repository evidence belongs to the separate backend/recovery check.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,readFileSync,statSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const REPO='hakaru4i-afk/freight-quotes-web';
const sha40=/^[a-f0-9]{40}$/;
const frontendSha=process.env.FRONTEND_SHA||'',backendSha=process.env.BACKEND_SHA||'',token=process.env.GITHUB_WEB_TOKEN||'';
if(!sha40.test(frontendSha)||!sha40.test(backendSha)||!token)throw Error('E2E_EXACT_SHA_OR_WEB_TOKEN_MISSING');
const request=async path=>{
 const r=await fetch('https://api.github.com/repos/'+REPO+path,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('E2E_FRONTEND_GITHUB_READ_FAILED:'+r.status);
 return r.json();
};
const runs=await request('/actions/runs?head_sha='+frontendSha+'&per_page=100');
if(!Array.isArray(runs.workflow_runs)||runs.total_count>100)throw Error('E2E_FRONTEND_RUNS_INCOMPLETE');
const matches=runs.workflow_runs.filter(r=>r.name==='Carrier124 live OIDC acceptance on isolated SH59 (11 roles)'&&r.head_sha===frontendSha&&r.event==='workflow_dispatch');
matches.sort((a,b)=>Date.parse(b.created_at||'')-Date.parse(a.created_at||'')||Number(b.id)-Number(a.id));
const latest=matches[0];
if(!latest)throw Error('E2E_AUTHENTICATED_RUN_MISSING_FOR_EXACT_FRONTEND_SHA');
const age=Date.now()-Date.parse(latest.updated_at||'');
if(latest.status!=='completed'||latest.conclusion!=='success'||!Number.isFinite(age)||age<0||age>=86400000)
 throw Error('E2E_LATEST_EXACT_SHA_RUN_NOT_FRESH_SUCCESS:'+latest.id);
const dir=mkdtempSync(join(tmpdir(),'owner-auth-e2e-'));
const walk=path=>readdirSync(path).flatMap(name=>{const f=join(path,name);return statSync(f).isDirectory()?walk(f):[f]});
try{
 mkdirSync(join(dir,'evidence'));
 execFileSync('gh',['run','download',String(latest.id),'-R',REPO,'--name','carrier124-oidc-sh59-redacted-evidence','--dir',join(dir,'evidence')],{
  env:{...process.env,GH_TOKEN:token},stdio:['ignore','pipe','pipe'],timeout:120000
 });
 const receipts=walk(dir).filter(f=>f.endsWith('/private-authenticated-e2e.json'));
 if(receipts.length!==1)throw Error('E2E_AUTHENTICATED_RECEIPT_MISSING');
 const data=JSON.parse(readFileSync(receipts[0],'utf8'));
 const scenarios=data.scenarios||[];
 if(data.authorized!==true||data.frontendSha!==frontendSha||data.backendSha!==backendSha||
    scenarios.length!==37||new Set(scenarios.map(s=>s.id)).size!==37||
    scenarios.some(s=>s.status!=='PASS'||s.mode!=='AUTHENTICATED_QA_API'||s.evidence?.responseVerified!==true))
  throw Error('E2E_37_REAL_AUTHENTICATED_RESULTS_NOT_VERIFIED_FOR_PAIR');
 console.log('PASS_REAL_AUTHENTICATED_37_OF_37_EXACT_SHA',frontendSha,backendSha,latest.id);
}finally{rmSync(dir,{recursive:true,force:true})}
