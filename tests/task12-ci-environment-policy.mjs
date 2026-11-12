import {execFileSync} from 'node:child_process';import{mkdir,writeFile}from'node:fs/promises';
const repository='hakaru4i-afk/freight-quotes-web',environment='isolated-qa';
export function validateEnvironmentPolicy(config,policies){
 if(config?.deployment_branch_policy?.custom_branch_policies!==true||config.deployment_branch_policy.protected_branches!==false)throw Error('QA_ENVIRONMENT_REQUIRES_SELECTED_MAIN_BRANCH');
 const rows=policies?.branch_policies;if(!Array.isArray(rows)||rows.length!==1||rows[0].name!=='main'||rows[0].type!=='branch')throw Error('QA_ENVIRONMENT_REQUIRES_ONLY_MAIN_NO_TAGS');
 return true;
}
async function main(){const report={environment,result:'BLOCKED'};try{
 if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main')throw Error('QA_WORKFLOW_REQUIRES_CANONICAL_MAIN');
 const api=path=>{try{return JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch{throw Error('QA_ENVIRONMENT_POLICY_READ_UNAVAILABLE');}};
 const base='repos/'+repository+'/environments/'+environment,config=api(base),policies=config.deployment_branch_policy?.custom_branch_policies?api(base+'/deployment-branch-policies'):null;
 validateEnvironmentPolicy(config,policies);report.result='PASS';report.mainBranchOnly=true;
 }catch(e){report.reason=e.message;process.exitCode=1;}
 await mkdir('reports',{recursive:true});await writeFile('reports/ci-qa-environment-policy.json',JSON.stringify(report,null,2)+'\n');console.log('QA_ENVIRONMENT_POLICY',report.result,report.reason||'MAIN_ONLY');}
if(process.argv[1]===import.meta.filename)await main();
