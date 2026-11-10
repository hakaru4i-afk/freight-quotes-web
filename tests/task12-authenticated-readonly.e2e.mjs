#!/usr/bin/env node
/**
 * Real HTTP authenticated QA integration, never mocks authentication.
 * Only the isolated Supabase QA function can be targeted. Fails closed if
 * protected credentials or independently-versioned QA setup are absent.
 * Does not create business orders or modify production/staging shared data.
 */
import {writeFile,mkdir} from "node:fs/promises";
const qaRun=process.env.QA_RUN_ID||"issue47qa";
if(!/^[a-z0-9]{8,24}$/.test(qaRun))throw Error("INVALID_QA_RUN_ID");
const base="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-"+qaRun;
const host=new URL(base).origin;
const roles=[
 {id:"owner",login:process.env.QA_OWNER_LOGIN,password:process.env.QA_OWNER_PASSWORD},
 {id:"carrier_a",login:process.env.QA_CARRIER_A_LOGIN,password:process.env.QA_CARRIER_A_PASSWORD},
 {id:"carrier_b",login:process.env.QA_CARRIER_B_LOGIN,password:process.env.QA_CARRIER_B_PASSWORD},
 {id:"logistic",login:process.env.QA_LOGISTIC_LOGIN,password:process.env.QA_LOGISTIC_PASSWORD}
];
await mkdir("reports",{recursive:true});
const results=[];
const sessions=[];
let blocker=null;
const log=(id,status,reason)=>{results.push({id,status,reason});console.log("QA_AUTH",id,status,reason)};
async function call(path,opts={},cookie=""){
 const res=await fetch(base+path,{
  ...opts,headers:{"Origin":"https://hakaru4i-afk.github.io","Cache-Control":"no-store",...(cookie?{Authorization:"Bearer "+cookie}:{}),...opts.headers},
  signal:AbortSignal.timeout(20000),redirect:"manual"
 });
 const raw=await res.text();
 // Do not print bodies; they can contain private values.
 return {status:res.status,data:(raw&&raw.length<200000)?JSON.parse(raw):{},cookieHeader:res.headers.get("set-cookie")||""};
}
try{
 const missing=roles.filter(x=>!x.login||!x.password).map(x=>x.id);
 if(missing.length)throw Error("PROTECTED_QA_CREDENTIALS_NOT_CONFIGURED:"+missing.join(","));
 const health=await call("/health");
 if(health.status!==200||health.data.projectRef!=="ibclzdkxiozbzmniiygv"||health.data.qaRun!==qaRun)
  throw Error("QA_ENDPOINT_ISOLATION_NOT_VERIFIED");
 if(process.env.QA_SCHEMA_PARITY_VERIFIED!=="true")throw Error("QA_SCHEMA_PARITY_NOT_VERIFIED");
 for(const actor of roles){
  const r=await call("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",login:actor.login,password:actor.password})});
  if(r.status!==200)throw Error("ROLE_LOGIN_FAILED:"+actor.id+":"+r.status);
  const cookie=r.data.sessionToken;
  if(typeof cookie!=="string"||! /^[0-9a-f]{64}$/.test(cookie))throw Error("AUTH_SESSION_TOKEN_INVALID:"+actor.id);
  sessions.push({id:actor.id,cookie});
  const profile=await call("/api/session",{},cookie);
  if(profile.status!==200||!profile.data||!profile.data.role)throw Error("ROLE_SESSION_INVALID:"+actor.id);
  const expected=actor.id.startsWith("carrier")?"carrier":actor.id;
  if(profile.data.role!==expected)throw Error("ROLE_MISMATCH:"+actor.id);
  log("LOGIN_"+actor.id,"PASS","Real QA session and role confirmed");
 }
 const actor=id=>sessions.find(x=>x.id===id).cookie;
 const negative=await call("/api/access",{},actor("carrier_a"));
 if(![200,403].includes(negative.status))throw Error("CARRIER_ACCESS_ENDPOINT_FAILED:"+negative.status);
 // Real positive and negative test, no data changes. The server must deny a
 // carrier from invoking the Owner's decision API, even with a valid session.
 const denied=await call("/api/offer-selection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order:"QA-NOT-EXISTING",bidId:"QA-BID-NOT-EXISTING"})},actor("carrier_a"));
 if(![401,403].includes(denied.status))throw Error("CARRIER_OWNER_DECISION_BYPASS:"+denied.status);
 log("ROLE_DENY_OWNER_DECISION","PASS","Carrier cannot choose Owner's winner via API");
 const writeAttempt=await call("/api/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order:"QA-NOT-EXISTING",deadline:"2027-06-15T12:00"})},actor("carrier_b"));
 if(![401,403].includes(writeAttempt.status))throw Error("CARRIER_OWNER_PUBLICATION_BYPASS:"+writeAttempt.status);
 log("ROLE_DENY_PUBLISH","PASS","Carrier cannot create shipment via API");
 log("AUTH_READONLY_COMPLETE","PASS","Real independent authorized credentials validated; business E2E still required.");
}catch(error){
 blocker=String(error?.message||"QA_AUTH_FAILED").replace(/[^A-Za-z0-9_:,-]/g,"").slice(0,180);
 log("AUTH_READONLY_COMPLETE","BLOCKED",blocker);
}finally{
 for(const s of sessions){try{await call("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})},s.cookie)}catch{}}
 const report={version:1,createdAt:new Date().toISOString(),environment:"isolated-qa",scope:"AUTHENTICATED_READONLY_PREFLIGHT",result:blocker?"BLOCKED":"PASS",reason:blocker,runId:process.env.GITHUB_RUN_ID||null,checks:results};
 await writeFile("reports/private-auth-qa-preflight.json",JSON.stringify(report,null,2)+"\n");
}
if(blocker)process.exitCode=1;
