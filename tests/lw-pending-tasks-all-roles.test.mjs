import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../test/lw-pending-tasks-all-roles-20261109.js",import.meta.url),"utf8");
const injected=code.replace(/\}\)\(\);\s*$/, "globalThis.__inboxQA={loadRole,unique,makeTask,isOpen};})();");
assert.notEqual(injected,code,"Cannot expose role inbox helpers for isolated regression");

function harness(data){
 const hits=[];
 const scope={
  fetch:async(path)=>{
   hits.push(path);
   const value=data[path];
   if(value===undefined)return {ok:false,status:403,json:async()=>({error:"Forbidden"})};
   return {ok:true,status:200,json:async()=>value};
  },
  document:{
   documentElement:{lang:"ru"},
   addEventListener(){},
   getElementById(){return null;},
   querySelector(){return null;},
   querySelectorAll(){return [];},
   hidden:false
  },
  window:{addEventListener(){}},
  MutationObserver:class{observe(){}},
  requestAnimationFrame(){},
  CustomEvent:class {},
  console
 };
 vm.runInNewContext(injected,scope,{filename:"lw-pending-tasks-all-roles.js"});
 return {...scope.__inboxQA,hits};
}
const noSession={"/api/session":{role:null,authenticated:false}};

test("owner sees genuine active decisions, excludes deferred transport application",async()=>{
 const api=harness({...noSession,
  "/api/workload":{counts:{bids:2,transport_stages:12,booking_rates:4,incidents:1},items:[
   {category:"bids",id:"bid-123",label:"Ставки на рассмотрении",order_code:"TEST-001",section:"offers",created:"2026-11-09T00:00:00Z"},
   {category:"transport_stages",id:"legacy",label:"Согласование заявки",section:"transport-applications"}
  ]},
  "/api/portal-feedback":{items:[
   {id:"p1",code:"IM-26-001",status:"sent",description:"UI fix",created_at:"2026-11-08T00:00:00Z"},
   {id:"p2",status:"completed",description:"Closed"}
  ]}
 });
 const result=await api.loadRole("owner");
 assert.equal(result.total,4);
 assert.equal(result.tasks.length,2);
 assert.ok(result.tasks.some(t=>t.route==="offers"));
 assert.ok(result.tasks.some(t=>t.route==="portal-feedback"));
 assert.ok(!result.tasks.some(t=>t.id.includes("legacy")));
});

test("VED sees only open document tasks assigned to shared logistic role",async()=>{
 const api=harness({...noSession,
  "/api/access":{access:{login:"user@domain.test"}},
  "/api/task2":{items:[{order_code:"TEST-001",process_status:"in_progress"}]},
  "/api/task2?order=TEST-001":{state:{status:"in_progress"},tasks:[
   {id:"ok",assigned_role:"logistic",assigned_login:null,status:"open",task_type:"transport_documents",description:"Упаковочный лист"},
   {id:"done",assigned_role:"logistic",status:"completed",task_type:"pto_review"},
   {id:"warehouse",assigned_role:"logistic",status:"open",task_type:"warehouse_acceptance"},
   {id:"me",assigned_role:"logistic",assigned_login:"user@domain.test",status:"open",task_type:"pto_review"},
   {id:"other-user",assigned_role:"logistic",assigned_login:"other@domain.test",status:"open",task_type:"pto_review"}
  ]}
 });
 const result=await api.loadRole("logistic");
 assert.equal(result.tasks.length,2);
 assert.match(result.tasks[0].detail,/Упаковочный лист/);
 assert.equal(result.tasks[0].route,"approved-shipments");
});

test("carrier sees awards awaiting acceptance and assigned container document task",async()=>{
 const api=harness({...noSession,
  "/api/task2":{items:[
   {order_code:"TEST-WON",process_status:"awaiting_take"},
   {order_code:"TEST-ROAD",process_status:"in_progress"}
  ]},
  "/api/task2?order=TEST-ROAD":{state:{status:"in_progress",actual_departure:"2026-11-08T00:00:00Z"},tasks:[
   {id:"container-1",assigned_role:"carrier",task_type:"container_number",status:"open",description:"Укажите номер контейнера"},
   {id:"old",assigned_role:"carrier",task_type:"container_number",status:"completed"}
  ]},
  "/api/carrier":{notifications:[
   {id:"new",order_code:"TEST-QUOTE",round_id:"R1",workflow_status:"pending",is_current:1},
   {id:"old",order_code:"TEST-OLD",round_id:"R0",workflow_status:"pending",is_current:0},
   {id:"quoted",order_code:"TEST-BID",round_id:"R2",workflow_status:"pending",is_current:1}
  ],bids:[{round_id:"R2",order_code:"TEST-BID",decision:"pending"}]}
 });
 const result=await api.loadRole("carrier");
 assert.equal(result.tasks.length,3);
 assert.deepEqual(new Set(result.tasks.map(t=>t.id)),new Set(["take:TEST-WON","carrier:container-1","invite:new"]));
});

test("supplier and designer only receive own pending orders and content tasks from access-scoped supplier API",async()=>{
 const supplierData={...noSession,"/api/supplier-orders":{orders:[
   {id:"s1",order_code:"TEST-S1",state:"assigned"},
   {id:"s2",order_code:"TEST-S2",state:"completed"}
 ]}};
 const supplier=await harness(supplierData).loadRole("supplier");
 assert.equal(supplier.tasks.length,1);
 assert.equal(supplier.tasks[0].route,"supplier-orders");
 const designer=await harness({...noSession,"/api/supplier-orders":{orders:[
   {id:"a1",task_id:"d1",content_state:"new",order_code:"TEST-D1"},
   {id:"a2",task_id:"d2",content_state:"completed",order_code:"TEST-D2"}
 ]}}).loadRole("designer");
 assert.equal(designer.tasks.length,1);
 assert.equal(designer.tasks[0].route,"content-tasks");
});

test("content, purchasing and certification read genuine open workflow assignments",async()=>{
 const inbox=harness({...noSession,"/api/pending-tasks":{total:1,items:[{id:"real-qa-assignment",description:"Assigned review",order_code:"QA-1",status:"open"},{id:"finished",status:"completed"}]}});
 for(const role of ["content","purchasing","certification"]){
  const v=await inbox.loadRole(role);
  assert.equal(v.supported,true);assert.equal(v.tasks.length,1);assert.equal(v.tasks[0].inline,true);
  assert.match(v.tasks[0].id,/real-qa-assignment/);
 }
});

test("role inbox escapes malicious labels before browser insertion; no fake clickable route",()=>{
 const q=harness(noSession);
 const t=q.makeTask("x","<img src=x>","<script>alert(1)</script>","javascript:alert(1)","ORDER");
 assert.equal(t.route,"approved-shipments");
 assert.ok(q.isOpen("open"));
 assert.equal(q.isOpen("completed"),false);
});

test("pending-work banner mounts on every role home, including VED child and dark Owner command",()=>{
 const sourceForPaint=code
  .replace(/\}\)\(\);\s*$/, "globalThis.__renderQA={paint,state,makeTask};})();")
  .replace(/refresh\(true\);\s*queue\(\);\s*globalThis\.__renderQA/, "globalThis.__renderQA");
 for(const role of ["owner","carrier","logistic","supplier","designer","content","purchasing","certification"]){
  const domRole=role==="logistic"?"ved":role;
  let mounted=null;
  const home={contains(el){return el===mounted;},prepend(el){mounted=el;}};
  const panel={querySelector(s){return s==="#ved-home-20261108"&&role==="logistic"||s==="#lw-owner-command"&&role==="owner"?home:null;},contains:home.contains,prepend:home.prepend};
  const cabinet={querySelector(s){return s.includes("overview")?panel:null;},dataset:{cabinetRole:domRole}};
  const doc={
   documentElement:{lang:"ru"},addEventListener(){},
   querySelector(s){if(s==="#root main.card"&&["content","purchasing","certification"].includes(role))return home;return s==='.cabinet-app[data-cabinet-role="'+domRole+'"]'?cabinet:null;},
   querySelectorAll(s){return s===".cabinet-app"?[cabinet]:[];},
   getElementById(){return mounted;},
   createElement(){return {dataset:{},setAttribute(){},innerHTML:""};},
   hidden:false
  };
  const ctx={document:doc,window:{addEventListener(){}},MutationObserver:class{observe(){}},requestAnimationFrame(){},fetch:async()=>({ok:false,status:403,json:async()=>({})}),console};
  vm.runInNewContext(sourceForPaint,ctx);
  const q=ctx.__renderQA;
  q.state.role=role;
  q.state.supported=!["content","purchasing","certification"].includes(role);
  q.state.items=q.state.supported?[q.makeTask("task","Проверить <img onerror=alert(1)>","Заказ 123","approved-shipments","123")]:[];
  q.state.total=q.state.items.length;
  q.state.loading=false;
  q.paint();
  assert.ok(mounted,'Inbox was not mounted for '+role);
  assert.match(mounted.innerHTML,/Задачи, ожидающие выполнения/);
  assert.doesNotMatch(mounted.innerHTML,/<img/);
  if(q.state.supported) assert.match(mounted.innerHTML,/href="#approved-shipments"/);
  else assert.match(mounted.innerHTML,/не подключён источник/);
 }
});
