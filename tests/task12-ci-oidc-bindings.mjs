// GitHub-hosted, protected main-only job: no static QA secrets or credential artifacts.
import{appendFileSync,readFileSync,writeFileSync,mkdirSync,rmSync}from'node:fs';
const actors=['owner','carrierA','carrierB','ved','logistic','supplier','supplierB','designer','content','purchasing','certification'];
const endpoint='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-qa-credential-broker';
const state='/tmp/freight-oidc-issued-actors.json',finish=process.argv.includes('--finish');let issued=[];
try{issued=JSON.parse(readFileSync(state,'utf8'));}catch{}
const target=finish?issued:actors;if(!target.length){console.log('QA_OIDC_CLEANUP_NOT_NEEDED');process.exit(0);}
try{
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='hakaru4i-afk/freight-quotes-web'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw Error('PROTECTED_MAIN_JOB_REQUIRED');
 if(!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||!process.env.ACTIONS_ID_TOKEN_REQUEST_URL)throw Error('GITHUB_OIDC_PERMISSION_REQUIRED');
 for(const actor of target){
  const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);if(url.protocol!=='https:')throw Error('HTTPS_IDENTITY_REQUIRED');url.searchParams.set('audience','freight-isolated-qa-credentials');
  const identityResponse=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(30000)});if(!identityResponse.ok)throw Error('GITHUB_IDENTITY_UNAVAILABLE');const {value:identity}=await identityResponse.json();if(!identity)throw Error('GITHUB_IDENTITY_EMPTY');
  const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+identity,'Content-Type':'application/json'},body:JSON.stringify({action:finish?'finish':'issue',actor}),signal:AbortSignal.timeout(45000)}),data=await r.json();
  if(!r.ok||!data.ok)throw Error('QA_BROKER_'+r.status+'_'+String(data.error||'UNAVAILABLE').replace(/[^A-Z_]/g,'').slice(0,60));
  if(!finish){
   if(!/^[a-f0-9]{64}$/.test(data.password||'')||!/^rc20261110-[a-z]+$/.test(data.login||'')||!['OWNER','CARRIER_A','CARRIER_B','VED','LOGISTIC','SUPPLIER','SUPPLIER_B','DESIGNER','CONTENT','PURCHASING','CERTIFICATION'].includes(data.prefix))throw Error('QA_BROKER_RESPONSE_INVALID');
   console.log('::add-mask::'+data.password);
   appendFileSync(process.env.GITHUB_ENV,'QA_'+data.prefix+'_LOGIN='+data.login+'\nQA_'+data.prefix+'_PASSWORD='+data.password+'\n');
   if(!issued.includes(actor))issued.push(actor);writeFileSync(state,JSON.stringify(issued),{mode:0o600});
  }
  console.log(finish?'QA_OIDC_FIXTURE_CLOSED':'QA_OIDC_FIXTURE_READY',actor);
 }
 if(finish)rmSync(state,{force:true});
}catch(error){console.log('QA_OIDC_BLOCKED',String(error.message).replace(/[^A-Z0-9_:]/g,'').slice(0,180));process.exitCode=1;}
