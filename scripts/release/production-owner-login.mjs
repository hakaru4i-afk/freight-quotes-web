import assert from 'node:assert/strict';

// Only the exact immutable Production endpoint may receive owner credentials.
// No service-role key, fake session, retry, credential logging or redirects.
export function validateSmokeCredentials(login,password){
 assert.ok(typeof login==='string'&&/^[a-z0-9._-]{3,60}$/.test(login.trim().toLowerCase())&&typeof password==='string'&&password.length>0&&password.length<=200,'PRODUCTION_SMOKE_OWNER_CREDENTIALS_REQUIRED');
}
export async function loginProductionOwner({endpoint,login,password,fetchImpl=fetch}){
 validateSmokeCredentials(login,password);
 assert.match(endpoint,/^https:\/\/ooclsrndeygojtofuyte\.supabase\.co\/functions\/v1\/freight-api-release-[a-f0-9]{32}$/,'PRODUCTION_SMOKE_ENDPOINT_INVALID');
 let response;
 try{
  response=await fetchImpl(endpoint+'/api/auth?forceFunctionRegion=eu-central-1',{
   method:'POST',headers:{Origin:'https://hakaru4i-afk.github.io','Content-Type':'application/json'},
   body:JSON.stringify({action:'login',login,password}),redirect:'error',signal:AbortSignal.timeout(20000)
  });
 }catch{throw Error('PRODUCTION_LOGIN_NETWORK_FAILURE');}
 if(response.status!==200)throw Error(response.status===401?'PRODUCTION_LOGIN_REJECTED_401':response.status===429?'PRODUCTION_LOGIN_RATE_LIMIT_429':'PRODUCTION_LOGIN_HTTP_'+response.status);
 let receipt;try{receipt=await response.json();}catch{throw Error('NORMAL_LOGIN_DID_NOT_ISSUE_SESSION');}
 assert.ok(receipt?.ok===true&&typeof receipt.sessionToken==='string'&&/^[a-f0-9]{64}$/.test(receipt.sessionToken),'NORMAL_LOGIN_DID_NOT_ISSUE_SESSION');
 return receipt.sessionToken;
}
