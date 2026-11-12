// Configure only the synthetic normal Logistic, through the audited Owner API.
export async function ensureAddressedLogistic(request,login,token){
 if(login!=='rc20261110-logistic')throw Error('QA_LOGISTIC_SCOPE_MISMATCH');
 const current=await request('/api/access',null,token);if(current.status!==200)throw Error('QA_ACCESS_READ_FAILED');
 const profile=current.data.profiles.find(p=>p.login===login),permissions=['workspace.read','shipments.read'];
 let saved=profile?.permissions;try{if(typeof saved==='string')saved=JSON.parse(saved);}catch{}
 if(profile?.scope==='assigned'&&Array.isArray(saved)&&saved.length===permissions.length&&permissions.every(p=>saved.includes(p)))return;
 const result=await request('/api/access',{action:'user_save',target:login,permissions,scope:'assigned',tasks:[],revision:Number(profile?.revision||0),reason:'SECURITY-GATE-12NOV: isolated addressed Logistic, no VED authority'},token);
 if(result.status!==200)throw Error('QA_LOGISTIC_PROFILE_FAILED:'+result.status);
}
