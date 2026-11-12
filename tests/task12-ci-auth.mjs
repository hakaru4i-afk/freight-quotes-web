import{ensureAddressedLogistic}from'./qa-addressed-logistic-profile.mjs';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
const path='/tmp/freight-ci-qa/sessions.json',base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const actors={owner:['OWNER','owner'],carrierA:['CARRIER_A','carrier'],carrierB:['CARRIER_B','carrier'],ved:['VED','logistic'],logistic:['LOGISTIC','logistic'],supplier:['SUPPLIER','supplier'],supplierB:['SUPPLIER_B','supplier'],designer:['DESIGNER','designer'],content:['CONTENT','content'],purchasing:['PURCHASING','purchasing'],certification:['CERTIFICATION','certification']};
async function request(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return{status:r.status,data:await r.json()};}
if(process.argv.includes('--logout')){
 let sessions={};try{sessions=JSON.parse(await readFile(path,'utf8'));}catch{}
 let failed=0;for(const token of Object.values(sessions)){try{if((await request('/api/auth',{action:'logout'},token)).status!==200)failed++;}catch{failed++;}}
 await rm('/tmp/freight-ci-qa',{recursive:true,force:true});console.log('QA_SESSION_CLEANUP',failed?'FAILED':'PASS');if(failed)process.exitCode=1;
}else{
 const report={result:'BLOCKED',environment:'isolated-qa',checks:[]};
 try{
  const missing=Object.entries(actors).filter(([, [prefix]])=>!process.env['QA_'+prefix+'_LOGIN']||!process.env['QA_'+prefix+'_PASSWORD']).map(([id])=>id);
  if(missing.length)throw Error('MISSING_PROTECTED_QA_BINDINGS:'+missing.join(','));
  for(const [id,[prefix]]of Object.entries(actors))if(process.env['QA_'+prefix+'_LOGIN']!=='rc20261110-'+id.toLowerCase())throw Error('QA_LOGIN_SCOPE_MISMATCH:'+id);
  const h=await request('/health');if(h.status!==200||h.data.qaRun!=='rc20261110'||h.data.projectRef!=='ibclzdkxiozbzmniiygv')throw Error('QA_ISOLATION_NOT_VERIFIED');
  await mkdir('/tmp/freight-ci-qa',{recursive:true,mode:0o700});await writeFile('/tmp/freight-ci-qa/actors.json',JSON.stringify(Object.fromEntries(Object.entries(actors).map(([id,[prefix,role]])=>[id,{login:process.env['QA_'+prefix+'_LOGIN'],role}]))),{mode:0o600});const sessions={};
  for(const [id,[prefix,role]]of Object.entries(actors)){
   const auth=await request('/api/auth',{action:'login',login:process.env['QA_'+prefix+'_LOGIN'],password:process.env['QA_'+prefix+'_PASSWORD']});
   if(auth.status!==200||! /^[a-f0-9]{64}$/.test(auth.data.sessionToken||''))throw Error('QA_LOGIN_FAILED:'+id+':'+auth.status);
   sessions[id]=auth.data.sessionToken;await writeFile(path,JSON.stringify(sessions),{mode:0o600});
   const profile=await request('/api/session',null,sessions[id]);if(profile.status!==200||profile.data.role!==role)throw Error('QA_ROLE_MISMATCH:'+id);
   report.checks.push({actor:id,result:'PASS',profileStatus:profile.status});console.log('QA_REAL_AUTH_PASS',id);
  }
  await ensureAddressedLogistic(request,process.env.QA_LOGISTIC_LOGIN,sessions.owner);
  report.result='PASS';
 }catch(e){report.reason=String(e.message).replace(/[^A-Za-z0-9_:,-]/g,'').slice(0,250);console.log('QA_AUTH_BLOCKED',report.reason);process.exitCode=1;}
 await mkdir('reports',{recursive:true});await writeFile('reports/ci-qa-auth.json',JSON.stringify(report,null,2));
}
