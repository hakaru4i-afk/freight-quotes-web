import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const published=readFileSync("release/candidates/lw-carrier-winner-only-home-sh71.js","utf8");
const source=readFileSync("lw-pending-tasks-all-roles-20261109.js","utf8");
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

test("Owner process-control addition preserves every line of published SH71 carrier logic",()=>{
 const p=readFileSync("lw-pending-tasks-all-roles-20261109.js","utf8");
 const staging=readFileSync("test/lw-pending-tasks-all-roles-20261109.js","utf8");
 const start=p.indexOf('\nconst CONTROL_ID="lw-owner-process-control";');
 const end=p.indexOf('function mount(){',start);
 assert.ok(start>=0&&end>start,"Expected isolated Owner-only block");
 const before=p.slice(0,start)+p.slice(end);
 const original=before
  .replace('function mount(){\n mountControl();','function mount(){')
  .replace('if(!roles.has(role)){clearControl();state.role="";','if(!roles.has(role)){state.role="";')
  .replace('if(role!==state.role){clearControl();state.visible=5;','if(role!==state.role){state.visible=5;')
  .replace(' }catch(_){\n  clearControl();\n  state.items=[];state.total=0;state.errors=["network"];',' }catch(_){\n  state.items=[];state.total=0;state.errors=["network"];');
 assert.equal(original,published);
 assert.notEqual(staging,published);
 assert.match(source,/async function fetchCarrier\(\)/);
 assert.doesNotMatch(source,/tasks.push\(makeTask\("invite:"/);
});


test("IM-2026-000004: production and staging render the same six authorized stage counters and filters",()=>{
 const apps=["app.js","test/app.js"].map(path=>readFileSync(path,"utf8"));
 for(const app of apps){
   const start=app.indexOf("function issue124CarrierMatches");
   const end=app.indexOf("function issue47Stage(n,b)",start);
   assert.ok(start>=0&&end>start,"Native carrier dashboard must exist in both roots");
   const ctx={r:(tag,props,key)=>({tag,props,key}),o:(tag,props,key)=>({tag,props,key})};
   vm.runInNewContext(app.slice(start,end)+"\nglobalThis.qa={issue124CarrierCards,issue124CarrierMatches};",ctx);
   const counts={new:0,viewed:0,preparing:0,review:0,selected:2,execution:0,all:16,requires_response:0,declined:0,lost:14,completed:0,archive:14};
   const dashboard={version:1,counts,items:[{id:"winner",stage:"selected",filters:["all"]},{id:"archive",stage:"lost",filters:["all","lost","archive"]}]};
   const selected=[];
   const tree=ctx.qa.issue124CarrierCards({dashboard,loading:false,error:"",onSelect:k=>selected.push(k),onRefresh:()=>{}});
   const cards=Array.from(tree.props.children[0].props.children);
   assert.deepEqual(cards.map(x=>x.props["data-carrier-stage"]),["new","viewed","preparing","review","selected","execution"]);
   assert.deepEqual(cards.map(x=>x.props.children[0].props.children),[0,0,0,0,2,0]);
   cards[4].props.onClick();assert.deepEqual(selected,["selected"]);
   assert.equal(ctx.qa.issue124CarrierMatches({id:"winner"},dashboard,"selected"),true);
   assert.equal(ctx.qa.issue124CarrierMatches({id:"archive"},dashboard,"selected"),false);
   assert.equal(ctx.qa.issue124CarrierMatches({id:"archive"},dashboard,"archive"),true);
   const error=ctx.qa.issue124CarrierCards({dashboard:null,loading:false,error:"unavailable",onSelect:()=>{},onRefresh:()=>{}});
   assert.equal(error.props.children[1].props.role,"alert");
   assert.ok(Array.from(error.props.children[0].props.children).every(x=>x.props.disabled&&x.props.children[0].props.children==="…"));
   assert.match(app,/r\(S0,\{notes:D,bids:b,policy:_,loading:S,updated:u,dashboard,error:N,onSelect:issue124Choose,onRefresh:de\}\)/);
   assert.match(app,/let j=D\.filter\(x=>issue124CarrierMatches\(x,dashboard,d,b\)/);
   assert.match(app,/function issue124Choose\(key\)\{g\(key\);m\(""\);c\(""\);location\.hash="#carrier-orders"\}/);
 }
 assert.equal(readFileSync("lw2-staging-20261107.js","utf8"),readFileSync("test/lw2-staging-20261107.js","utf8"));
 assert.match(readFileSync("lw2-staging-20261107.js","utf8"),/querySelector\('\[data-carrier-dashboard\]'\)\?''/);
 assert.equal(readFileSync("carrier-dashboard-compact-20261107.css","utf8"),readFileSync("test/carrier-dashboard-compact-20261107.css","utf8"));
 assert.match(readFileSync("bundle.css","utf8"),/\.carrier-stage-cards\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});
