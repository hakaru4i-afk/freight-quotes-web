import test from "node:test";
import assert from "node:assert/strict";
const host="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/";
const origins={
 staging:host+"freight-api",
 isolated:host+"freight-api-qa-issue47qa"
};
const headers={"Origin":"https://hakaru4i-afk.github.io","Cache-Control":"no-store"};
async function check(base,path,{method="GET",body}={}){
 const response=await fetch(base+path,{method,headers:{...headers,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:"manual"});
 const content=await response.text();
 assert.ok(content.length<4000,"unexpectedly large anonymous response at "+path);
 return {status:response.status,content};
}
for(const [name,base] of Object.entries(origins)){
 test(name+": live API health is available without exposing operational information",async()=>{
  const r=await check(base,"/health");
  assert.equal(r.status,200,name+" health "+r.status);
  const d=JSON.parse(r.content);
  assert.equal(d.projectRef,"ibclzdkxiozbzmniiygv");
  assert.notEqual(d.environment,"production");
  if(name==="isolated")assert.equal(d.qaRun,"issue47qa");
 });
 for(const endpoint of ["/api/requests","/api/carrier","/api/data","/api/bids","/api/documents","/api/task2","/api/registry","/api/offer-analysis"]){
  test(name+": anonymous API GET denied "+endpoint,async()=>{
   const r=await check(base,endpoint);
   assert.ok([401,403].includes(r.status),name+" "+endpoint+" returned "+r.status+" "+r.content.slice(0,100));
  });
 }
 for(const endpoint of ["/api/requests","/api/offer-selection","/api/task2"]){
  test(name+": anonymous API POST denied "+endpoint,async()=>{
   const r=await check(base,endpoint,{method:"POST",body:{order:"QA-ANON-NEVER-WRITE",action:"take",fields:{}}});
   assert.ok([401,403].includes(r.status),name+" "+endpoint+" returned "+r.status+" "+r.content.slice(0,100));
  });
 }
}
