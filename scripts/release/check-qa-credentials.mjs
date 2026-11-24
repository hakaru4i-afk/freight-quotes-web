import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function checkQaCredentials(mode,env=process.env,request=fetch,lock=JSON.parse(readFileSync('release-lock.json','utf8'))){
  if(!['backend','e2e'].includes(mode))throw Error('INVALID_QA_CREDENTIAL_MODE');
  const missing=['BACKEND_QA_READ_TOKEN',...(mode==='e2e'?['SUPABASE_ACCESS_TOKEN']:[])].filter(name=>!env[name]?.trim());
  if(missing.length)throw Error('MISSING_QA_SECRET:'+missing.join(','));
  if(!/^[a-f0-9]{40}$/.test(lock.backendSha||''))throw Error('INVALID_BACKEND_LOCK');
  let response;
  try{
    response=await request('https://api.github.com/repos/hakaru4i-afk/freight-quotes/commits/'+lock.backendSha,{
      headers:{Authorization:'Bearer '+env.BACKEND_QA_READ_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      redirect:'error',signal:AbortSignal.timeout(20000)
    });
  }catch{throw Error('BACKEND_QA_READ_REQUEST_FAILED');}
  if(!response.ok)throw Error('BACKEND_QA_READ_HTTP_'+response.status);
  const receipt=await response.json();
  if(receipt.sha!==lock.backendSha)throw Error('BACKEND_QA_READ_SHA_MISMATCH');
  return 'BACKEND_QA_EXACT_SOURCE_READ_PASS';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(await checkQaCredentials(process.argv[2]));}
  catch(error){console.error(/^([A-Z0-9_:,]+)$/.test(error.message)?error.message:'QA_CREDENTIAL_CHECK_FAILED');process.exitCode=1;}
}
