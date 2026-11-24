import test from'node:test';import assert from'node:assert/strict';import{readAndValidateEnvironmentPolicy,validateEnvironmentPolicy}from'./task12-ci-environment-policy.mjs';
const config={deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}},main={branch_policies:[{name:'main',type:'branch'}]};
test('QA credentials require the native environment main-only policy',()=>assert.equal(validateEnvironmentPolicy(config,main),true));
for(const [name,c,p]of [['unset environment policy',{},main],['any protected branch',{deployment_branch_policy:{custom_branch_policies:false,protected_branches:true}},main],['tag named main',config,{branch_policies:[{name:'main',type:'tag'}]}],['additional branch',config,{branch_policies:[...main.branch_policies,{name:'feature/*',type:'branch'}]}]])test('QA authentication is blocked for '+name,()=>assert.throws(()=>validateEnvironmentPolicy(c,p)));
test('reads both required native GitHub policies and rejects a forbidden response',async()=>{
 const paths=[];
 assert.equal(await readAndValidateEnvironmentPolicy('test-token',async(url,{headers,redirect})=>{
  assert.equal(headers.Authorization,'Bearer test-token');
  assert.equal(redirect,'error');
  paths.push(new URL(url).pathname);
  return Response.json(url.endsWith('/deployment-branch-policies')?main:config);
 }),true);
 assert.equal(paths.length,2);
 assert.match(paths[1],/isolated-qa\/deployment-branch-policies$/);
 await assert.rejects(readAndValidateEnvironmentPolicy('test-token',async()=>new Response(null,{status:403})),/QA_ENVIRONMENT_POLICY_HTTP_403/);
});
