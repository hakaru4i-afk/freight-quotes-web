import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const source=readFileSync("release/candidates/lw-carrier-winner-only-home-sh71.js","utf8");
const marker="refresh(true);\nqueue();\n})();\n";
assert.ok(source.endsWith(marker),"Cannot locate safe test bootstrap");
const withExports=source.replace(marker,"globalThis.__QA={fetchCarrier,fetchTask2,loadRole,word,state};\n})();");

function harness({login,items=[],tasks=[],errors=[],invitations=[]}={}){
 const calls=[];
 const api={
  "/api/task2?pending=1":errors.includes("task2")?null:{
   ok:true,pendingProjection:true,role:"carrier",viewer:login,
   items,tasks,limited:false
  },
  "/api/carrier":{notifications:invitations,bids:[]}
 };
 const ctx={
  document:{documentElement:{lang:"ru"},getElementById(){return null},
   querySelector(){return null},querySelectorAll(){return []},
   addEventListener(){},hidden:false},
  window:{addEventListener(){}},requestAnimationFrame(){},
  MutationObserver:class{observe(){}},console,
  fetch:async url=>{
   calls.push(url);
   if(api[url]==null)return {ok:false,status:503,json:async()=>({error:"service unavailable"})};
   return {ok:true,status:200,json:async()=>api[url]};
  }
 };
 vm.runInNewContext(withExports,ctx);
 return {api:ctx.__QA,calls};
}
const awarded=(order,status="awaiting_take")=>({
 order_code:order,award_id:"award-"+order,process_status:status,
 registration_no:order,departure_required:status==="in_progress"
});

test("Every carrier: home shows only own winning shipment tasks, never requests for a quote",async()=>{
 const examples=[
  {login:"jenty-1",items:[awarded("FR20260915-3"),awarded("FR20260915-8")],expected:["FR20260915-3","FR20260915-8"]},
  {login:"noytech1",items:[awarded("FR20260915-4")],expected:["FR20260915-4"]},
  {login:"upbelkaspian-1",items:[],expected:[]}
 ];
 for(const carrier of examples){
  const {api,calls}=harness({...carrier,invitations:[
   {id:"unawarded",order_code:"FR20260915-5",workflow_status:"new"},
   {id:"lost",order_code:"FR20260915-6",workflow_status:"processed"}
  ]});
  const result=await api.loadRole("carrier");
  assert.equal(result.supported,true);
  assert.deepEqual(Array.from(result.tasks.map(x=>x.order)).sort(),carrier.expected.sort());
  assert.equal(result.total,carrier.expected.length);
  assert.ok(result.tasks.every(t=>t.id.startsWith("take:")));
  assert.deepEqual(calls,["/api/task2?pending=1"],"No quote invitations or unrelated carrier data fetched");
 }
});

test("Won in progress: carrier still sees its actual departure and container work",async()=>{
 const {api}=harness({login:"winning-carrier",items:[awarded("ORDER-WON","in_progress")],
  tasks:[{id:"ct1",order_code:"ORDER-WON",assigned_role:"carrier",task_type:"container_number",status:"open",
          description:"Укажите номер контейнера"}]});
 const result=await api.fetchCarrier();
 assert.deepEqual(Array.from(result.tasks.map(t=>t.id)).sort(),["carrier:ct1","departure:ORDER-WON"]);
 assert.ok(!result.tasks.some(t=>/invite:/.test(t.id)));
});

test("Missing winner-only API fails closed and does not show invitations from any account",async()=>{
 const {api,calls}=harness({login:"jenty-1",errors:["task2"],
  invitations:[{id:"old",order_code:"FR20260915-5",workflow_status:"new"}]});
 const result=await api.fetchCarrier();
 assert.equal(result.tasks.length,0);
 assert.equal(result.total,0);
 assert.equal(result.errors.length,1);
 assert.deepEqual(calls,["/api/task2?pending=1"]);
});

test("Carrier-only heading says awarded work; other role titles remain unchanged",()=>{
 const {api}=harness({login:"carrier"});
 api.state.role="carrier";
 assert.equal(api.word("heading"),"Задачи по выигранным перевозкам");
 assert.equal(api.word("empty"),"Нет действий по выигранным перевозкам.");
 api.state.role="owner";
 assert.equal(api.word("heading"),"Задачи, ожидающие выполнения");
});

test("Published SH70 home and signed staging remain untouched before protected SH71",()=>{
 const p=readFileSync("lw-pending-tasks-all-roles-20261109.js","utf8");
 const staging=readFileSync("test/lw-pending-tasks-all-roles-20261109.js","utf8");
 assert.notEqual(p,source);
 assert.notEqual(staging,source);
 assert.match(source,/async function fetchCarrier\(\)/);
 assert.doesNotMatch(source,/tasks.push\(makeTask\("invite:"/);
});
