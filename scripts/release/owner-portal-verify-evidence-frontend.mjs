// A successful browser E2E run on main within 24 hours is sufficient.
// Source SHAs still identify deployable code, but do not invalidate a recent E2E PASS.
const REPO='hakaru4i-afk/freight-quotes-web';
const token=process.env.GITHUB_WEB_TOKEN||process.env.GITHUB_TOKEN||process.env.GH_TOKEN||'';
if(!token)throw Error('E2E_GITHUB_TOKEN_MISSING');
const response=await fetch('https://api.github.com/repos/'+REPO+'/actions/workflows/owner-main-e2e.yml/runs?branch=main&per_page=20',{
 headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token},
 signal:AbortSignal.timeout(30000)
});
if(!response.ok)throw Error('E2E_GITHUB_ACTIONS_READ_FAILED:'+response.status);
const data=await response.json();
if(!Array.isArray(data.workflow_runs))throw Error('E2E_MAIN_RUN_LIST_UNAVAILABLE');
const candidates=data.workflow_runs.filter(r=>r.head_branch==='main'&&r.event==='push');
candidates.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||Number(b.id)-Number(a.id));
const latest=candidates[0];
if(!latest)throw Error('E2E_MAIN_AUTOMATIC_RUN_MISSING');
const age=Date.now()-Date.parse(latest.updated_at||'');
if(latest.status!=='completed'||latest.conclusion!=='success'||!Number.isFinite(age)||age<0||age>=86400000)
 throw Error('E2E_MAIN_LATEST_RUN_NOT_FRESH_PASS:'+latest.id);
console.log('PASS_MAIN_BROWSER_E2E_WITHIN_24H',latest.id,latest.head_sha);
