/* LW-PENDING-TASKS-ALL: role-scoped, read-only pending work inbox for every staging cabinet.
   Uses existing authenticated API routes. Never caches other users' data or invents tasks. */
(function(){
"use strict";
const ROOT_ID="lw-pending-tasks-all-roles";
const roles=new Set(["owner","carrier","logistic","supplier","designer","content","purchasing","certification"]);
const availableRoutes=new Set(["approved-shipments","carrier-orders","offers","tender-hub","supplier-orders","content-tasks","team","winner-chats","incident-journal","portal-feedback","request-registry"]);
const closedTask=new Set(["completed","cancelled","deleted","denied","rejected","archived","closed"]);
const docTasks=new Set(["pto_review","missing_documents","transport_documents"]);
const toRole=s=>String(s||"").toLowerCase()==="ved"?"logistic":String(s||"").toLowerCase();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const short=(v,n=125)=>String(v??"").trim().slice(0,n);
const isOpen=v=>!closedTask.has(String(v||"").toLowerCase());
const stamp=v=>{if(!v)return 0;const d=Date.parse(String(v));return Number.isFinite(d)?d:0;};
const labels={
 ru:{heading:"Задачи, ожидающие выполнения",refresh:"Обновить",loading:"Проверяем назначения…",empty:"Сейчас нет ожидающих задач.",unsupported:"Для этого кабинета пока не подключён источник назначенных поручений.",failed:"Не удалось проверить задачи. Повторите обновление.",partial:"Не все источники задач доступны: список может быть неполным.",more:"Показаны первые 5 из ",open:"Открыть",number:"№",owner:"Решение владельца",received:"Предложение по доработке",ved:"Проверить документы",carrier:"Документы и перевозка",take:"Принять перевозку в работу",departure:"Указать фактический выход груза",supplier:"Документы и готовность поставки",designer:"Выполнить контент-задание",invitation:"Предоставить ставку",noDate:"Без срока",update:"Обновлено"},
 en:{heading:"Tasks awaiting action",refresh:"Refresh",loading:"Checking assigned work…",empty:"No pending tasks right now.",unsupported:"An assigned-task source is not yet connected for this role.",failed:"Could not check tasks. Refresh to try again.",partial:"Some task sources are unavailable; the list may be incomplete.",more:"Showing the first 5 of ",open:"Open",number:"No.",owner:"Owner decision",received:"Improvement suggestion",ved:"Review documents",carrier:"Shipment documents",take:"Accept awarded shipment",departure:"Record actual departure",supplier:"Supplier documents and readiness",designer:"Complete content task",invitation:"Submit quote",noDate:"No due date",update:"Updated"},
 zh:{heading:"待处理任务",refresh:"刷新",loading:"正在检查任务…",empty:"当前没有待处理任务。",unsupported:"该角色尚未连接已分配任务的数据源。",failed:"无法检查任务，请重试。",partial:"部分任务来源不可用，列表可能不完整。",more:"当前显示前 5 项，共 ",open:"打开",number:"编号",owner:"所有者待处理",received:"改进建议",ved:"审核文件",carrier:"运输文件",take:"接收中标运输",departure:"填写实际发运日期",supplier:"供应商文件与备货",designer:"处理内容任务",invitation:"提交报价",noDate:"无截止日期",update:"已更新"}
};
function language(){
 const lang=String(document.documentElement.lang||"ru").toLowerCase();
 return lang.startsWith("zh")?"zh":lang.startsWith("en")?"en":"ru";
}
function word(key){return(labels[language()]||labels.ru)[key]||key;}
function makeTask(id,label,detail,route,order,when){
 const target=availableRoutes.has(route)?route:"approved-shipments";
 return {id:String(id||""),label:short(label,110),detail:short(detail,180),route:target,order:short(order,120),when:when||""};
}
function unique(tasks){
 const seen=new Set();
 return tasks.filter(t=>{
  if(!t||!t.id||!t.route||seen.has(t.id))return false;
  seen.add(t.id);return true;
 }).sort((a,b)=>stamp(b.when)-stamp(a.when)||a.id.localeCompare(b.id));
}
async function get(path){
 const r=await fetch(path,{credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}});
 const data=await r.json().catch(()=>null);
 if(!r.ok||!data||typeof data!=="object")throw Error("HTTP "+r.status);
 return data;
}
async function fetchOwner(){
 const results=await Promise.allSettled([get("/api/workload"),get("/api/portal-feedback")]);
 const tasks=[],errors=[];
 let total=0;
 if(results[0].status==="fulfilled"){
  const d=results[0].value,omitted=new Set(["booking_rates","transport_stages"]);
  const counts=d.counts||{};
  total+=Object.entries(counts).filter(([k])=>!omitted.has(k)).reduce((n,[,v])=>n+(Number(v)||0),0);
  for(const r of Array.isArray(d.items)?d.items:[]){
   if(omitted.has(r.category))continue;
   const route=availableRoutes.has(r.section)?r.section:"request-registry";
   tasks.push(makeTask("owner:"+r.category+":"+r.id,r.label||word("owner"),r.order_code||"",route,r.order_code,r.created));
  }
 }else errors.push("Нагрузка владельца");
 if(results[1].status==="fulfilled"){
  const list=Array.isArray(results[1].value.items)?results[1].value.items:[];
  const pending=list.filter(r=>["sent","read","evaluated","in_progress","release"].includes(String(r.status||"")));
  total+=pending.length;
  for(const r of pending.slice(0,20))tasks.push(makeTask("feedback:"+r.id,word("received"),(r.code||"")+" · "+short(r.description,65),"portal-feedback","",r.created_at));
 }else errors.push("Предложения");
 return {tasks,total:Math.max(total,tasks.length),errors,supported:true};
}
async function fetchTask2(role){
 const d=await get("/api/task2");
 if(!Array.isArray(d.items))throw Error("Unexpected shipment list");
 const rows=d.items.filter(x=>x&&x.order_code&&x.process_status!=="completed");
 const tasks=[],errors=[];
 for(const x of rows){
  if(role==="carrier"&&x.process_status==="awaiting_take"){
   tasks.push(makeTask("take:"+x.order_code,word("take"),x.registration_no||x.order_code,"approved-shipments",x.order_code,x.created));
  }
 }
 // Read at most 32 relevant shipments, in small groups, to avoid flooding the user's session.
 const candidates=rows.filter(x=>x.process_status!=="awaiting_take");
 const active=candidates.slice(0,32);
 for(let i=0;i<active.length;i+=4){
  const outcome=await Promise.allSettled(active.slice(i,i+4).map(x=>get("/api/task2?order="+encodeURIComponent(x.order_code))));
  outcome.forEach((o,j)=>{
   if(o.status!=="fulfilled"){errors.push("Перевозка");return;}
   const d=o.value,x=active[i+j],state=d.state||{};
   if(role==="carrier"&&!state.actual_departure&&state.status!=="completed"){
    tasks.push(makeTask("departure:"+x.order_code,word("departure"),x.registration_no||x.order_code,"approved-shipments",x.order_code,""));
   }
   for(const t of Array.isArray(d.tasks)?d.tasks:[]){
    if(!isOpen(t.status))continue;
    if(role==="logistic"){
     if(t.assigned_role!=="logistic"||t.assigned_login||!docTasks.has(t.task_type))continue;
     tasks.push(makeTask("ved:"+t.id,word("ved"),(x.registration_no||x.order_code)+" · "+(t.description||t.task_type),"approved-shipments",x.order_code,t.created_at));
    }else if(role==="carrier"){
     if(t.assigned_role!=="carrier"||t.task_type!=="container_number")continue;
     tasks.push(makeTask("carrier:"+t.id,word("carrier"),(x.registration_no||x.order_code)+" · "+(t.description||""),"approved-shipments",x.order_code,t.created_at));
    }
   }
  });
 }
 if(candidates.length>active.length)errors.push("Не все перевозки проверены");
 return {tasks,total:tasks.length,errors,supported:true};
}
async function fetchCarrier(){
 const outcomes=await Promise.allSettled([fetchTask2("carrier"),get("/api/carrier")]);
 const tasks=[],errors=[];
 if(outcomes[0].status==="fulfilled"){tasks.push(...outcomes[0].value.tasks);errors.push(...outcomes[0].value.errors);}else errors.push("Исполнение перевозок");
 if(outcomes[1].status==="fulfilled"){
  const d=outcomes[1].value;
  const quotes=new Set((Array.isArray(d.bids)?d.bids:[]).filter(b=>!["withdrawn","cancelled"].includes(b.decision)).map(b=>String(b.round_id||"")+"::"+String(b.order_code||"")));
  for(const n of Array.isArray(d.notifications)?d.notifications:[]){
   if(n.is_current===0||n.is_current===false||n.decline_reason||["approved","rejected","annulled","deleted","completed"].includes(n.workflow_status))continue;
   if(quotes.has(String(n.round_id||"")+"::"+String(n.order_code||"")))continue;
   tasks.push(makeTask("invite:"+n.id,word("invitation"),(n.order_code||"")+" · "+short(n.summary,75),"carrier-orders",n.order_code,n.created));
  }
 }else errors.push("Входящие заявки");
 if(outcomes.every(x=>x.status==="rejected"))return {tasks:[],total:0,errors,supported:true};
 return {tasks,total:tasks.length,errors,supported:true};
}
async function fetchSupplier(role){
 const d=await get("/api/supplier-orders");
 if(!Array.isArray(d.orders))throw Error("Missing supplier orders");
 const tasks=[];
 for(const o of d.orders){
  if(!o?.id)continue;
  if(role==="supplier"){
   if(!isOpen(o.state)||o.state==="completed")continue;
   tasks.push(makeTask("supplier:"+o.id,word("supplier"),(o.order_code||"")+" · "+(o.description||""),"supplier-orders",o.order_code,o.changed));
  }else{
   if(!o.task_id||!isOpen(o.content_state)||o.content_state==="waiting_supplier")continue;
   tasks.push(makeTask("designer:"+o.task_id,word("designer"),o.order_code||"","content-tasks",o.order_code,o.changed));
  }
 }
 return {tasks,total:tasks.length,errors:[],supported:true};
}
async function loadRole(role){
 if(role==="owner")return fetchOwner();
 if(role==="carrier")return fetchCarrier();
 if(role==="logistic")return fetchTask2("logistic");
 if(role==="supplier"||role==="designer")return fetchSupplier(role);
 return {tasks:[],total:0,errors:[],supported:false};
}
const state={role:"",items:[],total:0,errors:[],supported:false,loading:false,loaded:false,updated:0,request:0};
let scheduled=false,refreshing=false;
function homeTarget(){
 const role=state.role;
 if(!roles.has(role))return null;
 const variants=role==="logistic"?["logistic","ved"]:role==="designer"?["designer","content-manager"]: [role];
 let cabinet=null;
 for(const r of variants){
  cabinet=document.querySelector('.cabinet-app[data-cabinet-role="'+r+'"]');
  if(cabinet)break;
 }
 if(!cabinet){
  const found=[...document.querySelectorAll(".cabinet-app")];
  cabinet=found.find(el=>toRole(el.dataset.cabinetRole)===role)||null;
 }
 let panel=cabinet?.querySelector('.cabinet-panel[data-section="overview"]')||null;
 if(panel&&role==="logistic")return panel.querySelector("#ved-home-20261108")||panel;
 if(panel&&role==="owner")return panel.querySelector("#lw-owner-command")||panel;
 if(panel)return panel;
 if(role==="carrier")return document.querySelector(".carrier-portal .workspace-hero")?.parentElement||document.querySelector(".carrier-portal");
 return null;
}
function paint(){
 const target=homeTarget();if(!target)return;
 let root=document.getElementById(ROOT_ID);
 if(!root){
  root=document.createElement("section");
  root.id=ROOT_ID;root.className="lw-pending-task-box";root.setAttribute("aria-label",word("heading"));
 }
 if(!target.contains(root))target.prepend(root);
 const items=unique(state.items),count=Math.max(items.length,state.total||0);
 let status=state.loading?'<div class="lw-pending-status">'+esc(word("loading"))+'</div>':
  !state.supported?'<div class="lw-pending-status">'+esc(word("unsupported"))+'</div>':
  !items.length&&state.errors.length?'<div class="lw-pending-error" role="alert">'+esc(word("failed"))+'</div>':
  !count?'<div class="lw-pending-status">'+esc(word("empty"))+'</div>':"";
 if(state.errors.length&&items.length)status+='<div class="lw-pending-warning">'+esc(word("partial"))+'</div>';
 const displayed=items.slice(0,5);
 const rows=displayed.map(task=>'<li><a href="#'+esc(task.route)+'" data-lw-task-open="'+esc(task.route)+'" data-lw-order="'+esc(task.order)+'"><span><strong>'+esc(task.label)+'</strong><small>'+esc(task.detail)+'</small></span><span class="lw-pending-arrow" aria-hidden="true">›</span></a></li>').join("");
 const more=count>5?'<div class="lw-pending-more">'+esc(word("more"))+count+'</div>':"";
 root.innerHTML='<div class="lw-pending-head"><div><h3>'+esc(word("heading"))+'</h3><span class="lw-pending-count" aria-label="'+esc(word("heading"))+'">'+(state.loading?"…":state.supported?count:"—")+'</span></div><button type="button" data-lw-tasks-refresh>'+esc(word("refresh"))+'</button></div>'+
  (rows?'<ul>'+rows+'</ul>':"")+status+more;
 root.dataset.taskRole=state.role;
}
async function refresh(force=false){
 if(refreshing)return;
 const now=Date.now();
 if(!force&&state.loaded&&now-state.updated<60000)return;
 refreshing=true;state.loading=true;paint();
 let token=++state.request;
 try{
  const session=await get("/api/session");
  const role=toRole(session.authenticated?session.role:"");
  if(!roles.has(role)){state.role="";state.items=[];state.total=0;state.loaded=false;return;}
  if(role!==state.role){state.role=role;state.items=[];state.total=0;state.loaded=false;state.errors=[];state.supported=false;}
  paint();
  const result=await loadRole(role);
  if(token!==state.request)return;
  state.items=result.tasks||[];state.total=result.total||0;state.errors=result.errors||[];
  state.supported=result.supported;state.loaded=true;state.updated=Date.now();
 }catch(_){
  state.items=[];state.total=0;state.errors=["network"];state.supported=true;state.loaded=true;state.updated=Date.now();
 }finally{state.loading=false;refreshing=false;paint();}
}
function mount(){
 if(!state.role||!homeTarget())return;
 if(!homeTarget().contains(document.getElementById(ROOT_ID)))paint();
}
function queue(){
 if(scheduled)return;scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;mount();});
}
document.addEventListener("click",event=>{
 const refreshButton=event.target.closest("#"+ROOT_ID+" [data-lw-tasks-refresh]");
 if(refreshButton){event.preventDefault();refresh(true);return;}
 const jump=event.target.closest("#"+ROOT_ID+" a[data-lw-task-open]");
 if(jump&&jump.dataset.lwOrder&&jump.dataset.lwTaskOpen==="approved-shipments"){
  window.dispatchEvent(new CustomEvent("carrier-flow-open-execution",{detail:{order:jump.dataset.lwOrder}}));
 }
});
document.addEventListener("DOMContentLoaded",()=>{refresh(true);queue();});
window.addEventListener("hashchange",()=>{refresh();queue();});
window.addEventListener("focus",()=>{if(Date.now()-state.updated>60000)refresh();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
document.addEventListener("freight-access-updated",()=>refresh(true));
new MutationObserver(queue).observe(document.getElementById("root")||document.documentElement,{childList:true,subtree:true});
refresh(true);
queue();
})();
