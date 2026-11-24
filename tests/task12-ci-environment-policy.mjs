import{mkdir,writeFile}from'node:fs/promises';
const repository='hakaru4i-afk/freight-quotes-web',environment='isolated-qa';
export function validateEnvironmentPolicy(config,policies){
 if(config?.deployment_branch_policy?.custom_branch_policies!==true||config.deployment_branch_policy.protected_branches!==false)throw Error('QA_ENVIRONMENT_REQUIRES_SELECTED_MAIN_BRANCH');
 const rows=policies?.branch_policies;if(!Array.isArray(rows)||rows.length!==1||rows[0].name!=='main'||rows[0].type!=='branch')throw Error('QA_ENVIRONMENT_REQUIRES_ONLY_MAIN_NO_TAGS');
 return true;
}
export async function readAndValidateEnvironmentPolicy(token, fetcher=fetch){
 if(!token)throw Error('QA_ENVIRONMENT_POLICY_READ_TOKEN_MISSING');
 const base='https://api.github.com/repos/'+repository+'/environments/'+environment;
 const get=async url=>{
  let response;
  try{
   response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'
   }});
  }catch{throw Error('QA_ENVIRONMENT_POLICY_READ_UNAVAILABLE');}
  if(!response.ok)throw Error('QA_ENVIRONMENT_POLICY_HTTP_'+response.status);
  return response.json();
 };
 const config=await get(base);
 const policies=config.deployment_branch_policy?.custom_branch_policies?await get(base+'/deployment-branch-policies'):null;
 return validateEnvironmentPolicy(config,policies);
}
async function main(){const report={environment,result:'BLOCKED'};try{
 if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main')throw Error('QA_WORKFLOW_REQUIRES_CANONICAL_MAIN');
 await readAndValidateEnvironmentPolicy(process.env.GH_TOKEN);report.result='PASS';report.mainBranchOnly=true;
 }catch(e){report.reason=e.message;process.exitCode=1;}
 await mkdir('reports',{recursive:true});await writeFile('reports/ci-qa-environment-policy.json',JSON.stringify(report,null,2)+'\n');console.log('QA_ENVIRONMENT_POLICY',report.result,report.reason||'MAIN_ONLY');}
if(process.argv[1]===import.meta.filename)await main();
