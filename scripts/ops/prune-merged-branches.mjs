// Safe maintenance: only prune old, fully merged and unreferenced short-lived branches.
// Dry run by default; never touch data, release/rollback refs or open PR heads.
const allowedPrefixes=['ci/','fix/','feat/','refactor/','test/','tooling/','perf/','codex/'];
const excludedPrefixes=['release/','recovery/','ops/','qa/','docs/','hotfix/','security/','spec/','feature/'];
const excludedExact=new Set(['main','master','develop','development','staging','test','production','prod','fix/carrier-dashboard-124']);
export function eligibleBranch({name,protectedBranch=false,openPR=false,aheadBy,latestCommit,defaultBranch='main',now=new Date(),minAgeDays=14}){
 if(!name||name===defaultBranch||protectedBranch||openPR||excludedExact.has(name))return false;
 if(excludedPrefixes.some(p=>name.startsWith(p)))return false;
 if(!allowedPrefixes.some(p=>name.startsWith(p)))return false;
 if(!Number.isInteger(aheadBy)||aheadBy!==0)return false;
 const timestamp=Date.parse(latestCommit||'');
 return Number.isFinite(timestamp)&&now.getTime()-timestamp>=minAgeDays*86400000;
}
async function main(){
 const opts=new Set(process.argv.slice(2));
 const repo=process.env.GITHUB_REPOSITORY;
 const token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
 if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo||''))throw Error('GITHUB_REPOSITORY_REQUIRED');
 if(!token)throw Error('GITHUB_TOKEN_REQUIRED');
 const apply=opts.has('--apply');
 if(apply&&process.env.CONFIRM_BRANCH_PRUNE!=='DELETE_MERGED_BRANCHES')throw Error('BRANCH_PRUNE_CONFIRMATION_REQUIRED');
 const target=process.env.BRANCH_PRUNE_TARGET?.trim()||null;
 if(target&&(target.includes('..')||target.startsWith('/')))throw Error('INVALID_BRANCH_TARGET');
 const api='https://api.github.com/repos/'+repo;
 const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
 const request=async(path,method='GET')=>{
  const response=await fetch(api+path,{method,headers});
  if(!response.ok)throw Error('GITHUB_API_'+response.status+' for '+method+' '+path.split('?')[0]);
  return response.status===204?null:response.json();
 };
 const list=async endpoint=>{
  const out=[];for(let page=1;page<=20;page++){
   const items=await request(endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page='+page);
   if(!Array.isArray(items))throw Error('GITHUB_COLLECTION_REQUIRED');
   out.push(...items);if(items.length<100)return out;
  }throw Error('GITHUB_PAGINATION_LIMIT');
 };
 const repoInfo=await request(''),defaultBranch=repoInfo.default_branch;
 const [branches,pulls]=await Promise.all([list('/branches'),list('/pulls?state=open')]);
 const openHeads=new Set(pulls.filter(p=>p.head?.repo?.full_name===repo).map(p=>p.head.ref));
 const now=new Date(),plan=[];
 for(const branch of branches){
  const name=branch.name;
  if(target&&name!==target)continue;
  if(name===defaultBranch||branch.protected||openHeads.has(name)||excludedExact.has(name)||excludedPrefixes.some(p=>name.startsWith(p))||!allowedPrefixes.some(p=>name.startsWith(p)))continue;
  const escaped=name.split('/').map(encodeURIComponent).join('/');
  const compare=await request('/compare/'+encodeURIComponent(defaultBranch)+'...'+escaped);
  if(compare.ahead_by!==0)continue;
  const commit=await request('/commits/'+encodeURIComponent(branch.commit.sha));
  const latestCommit=commit.commit?.committer?.date;
  if(!eligibleBranch({name,protectedBranch:branch.protected,openPR:false,aheadBy:compare.ahead_by,latestCommit,defaultBranch,now}))continue;
  plan.push({branch:name,aheadBy:compare.ahead_by,behindBy:compare.behind_by,lastCommit:latestCommit});
 }
 console.log(JSON.stringify({repo,defaultBranch,mode:apply?'APPLY':'DRY_RUN',totalBranches:branches.length,openPullRequests:pulls.length,candidates:plan},null,2));
 if(!apply)return;
 for(const row of plan){
  const branch=await request('/branches/'+row.branch.split('/').map(encodeURIComponent).join('/'));
  if(branch.protected||openHeads.has(row.branch)||branch.commit?.sha===repoInfo.default_branch)throw Error('BRANCH_CHANGED_DURING_CLEANUP');
  const fresh=await request('/compare/'+encodeURIComponent(defaultBranch)+'...'+row.branch.split('/').map(encodeURIComponent).join('/'));
  if(fresh.ahead_by!==0)throw Error('UNMERGED_BRANCH_REFUSED:'+row.branch);
  await request('/git/refs/heads/'+row.branch.split('/').map(encodeURIComponent).join('/'),'DELETE');
  console.log('DELETED_MERGED_BRANCH '+row.branch);
 }
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 main().catch(error=>{console.error('SAFE_BRANCH_PRUNE_FAILED',error.message);process.exitCode=1});
}
