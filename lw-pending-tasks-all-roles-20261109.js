/* LW-PENDING-TASKS-ALL: role-scoped, read-only pending work inbox for every staging cabinet.
   Uses existing authenticated API routes. Never caches other users' data or invents tasks. */
(function(){
"use strict";
const ROOT_ID="lw-pending-tasks-all-roles";
const roles=new Set(["owner","carrier","logistic","supplier","designer","content","purchasing","certification"]);
const availableRoutes=new Set(["approved-shipments","carrier-orders","offers","tender-hub","supplier-orders","content-tasks","team","winner-chats","incident-journal","portal-feedback","request-registry"]);
const closedTask=new Set(["completed","cancelled","deleted","denied","rejected","archived","closed"]);
const docTasks=new Set(["pto_review","missing_documents","transport_documents","ved_request_logistic"]);
const toRole=s=>String(s||"").toLowerCase()==="ved"?"logistic":String(s||"").toLowerCase();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const short=(v,n=125)=>String(v??"").trim().slice(0,n);
const isOpen=v=>!closedTask.has(String(v||"").toLowerCase());
const stamp=v=>{if(!v)return 0;const d=Date.parse(String(v));return Number.isFinite(d)?d:0;};
const labels={
 ru:{heading:"Задачи, ожидающие выполнения",refresh:"Обновить",loading:"Проверяем назначения…",empty:"Сейчас нет ожидающих задач.",unsupported:"Для этого кабинета пока не подключён источник назначенных поручений.",failed:"Не удалось проверить задачи. Повторите обновление.",partial:"Не все источники задач доступны: список может быть неполным.",more:"Показано",of:"из",showMore:"Показать ещё",open:"Открыть",number:"№",owner:"Решение владельца",received:"Предложение по доработке",ved:"Проверить документы",carrier:"Документы и перевозка",take:"Принять перевозку в работу",departure:"Указать фактический выход груза",supplier:"Документы и готовность поставки",designer:"Выполнить контент-задание",invitation:"Предоставить ставку",noDate:"Без срока",update:"Обновлено"},
 en:{heading:"Tasks awaiting action",refresh:"Refresh",loading:"Checking assigned work…",empty:"No pending tasks right now.",unsupported:"An assigned-task source is not yet connected for this role.",failed:"Could not check tasks. Refresh to try again.",partial:"Some task sources are unavailable; the list may be incomplete.",more:"Showing",of:"of",showMore:"Show more",open:"Open",number:"No.",owner:"Owner decision",received:"Improvement suggestion",ved:"Review documents",carrier:"Shipment documents",take:"Accept awarded shipment",departure:"Record actual departure",supplier:"Supplier documents and readiness",designer:"Complete content task",invitation:"Submit quote",noDate:"No due date",update:"Updated"},
 zh:{heading:"待处理任务",refresh:"刷新",loading:"正在检查任务…",empty:"当前没有待处理任务。",unsupported:"该角色尚未连接已分配任务的数据源。",failed:"无法检查任务，请重试。",partial:"部分任务来源不可用，列表可能不完整。",more:"已显示",of:"总数",showMore:"显示更多",open:"打开",number:"编号",owner:"所有者待处理",received:"改进建议",ved:"审核文件",carrier:"运输文件",take:"接收中标运输",departure:"填写实际发运日期",supplier:"供应商文件与备货",designer:"处理内容任务",invitation:"提交报价",noDate:"无截止日期",update:"已更新"}
};
function language(){
 const lang=String(document.documentElement.lang||"ru").toLowerCase();
 return lang.startsWith("zh")?"zh":lang.startsWith("en")?"en":"ru";
}
function word(key){
 const lang=language();
 if(state.role==="carrier"){
  const carrierLabels={
   ru:{heading:"Задачи по выигранным перевозкам",empty:"Нет действий по выигранным перевозкам.",failed:"Не удалось проверить выигранные перевозки. Обновите список."},
   en:{heading:"Tasks for awarded shipments",empty:"No pending work on awarded shipments.",failed:"Could not check awarded shipments. Refresh to try again."},
   zh:{heading:"已中标运输的待办任务",empty:"目前没有已中标运输的待办事项。",failed:"无法检查中标运输，请刷新重试。"}
  };
  if(carrierLabels[lang]?.[key])return carrierLabels[lang][key];
 }
 return(labels[lang]||labels.ru)[key]||key;
}
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
 const results=await Promise.allSettled([get("/api/workload"),get("/api/portal-feedback"),get("/api/pending-tasks")]);
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
 if(results[2].status==="fulfilled"){
  const items=Array.isArray(results[2].value.items)?results[2].value.items:[];
  const fallback=items.filter(t=>t.task_type==="other"&&String(t.dedupe_key||"").startsWith("owner-pto:")&&isOpen(t.status));
  total+=fallback.length;
  for(const t of fallback){
   tasks.push(makeTask("owner-review:"+t.id,
     language()==="en"?"Start foreign-trade document review":language()==="zh"?"启动外贸文件审核":"Запустить проверку документов ВЭД",
     (t.registration_no||t.order_code)+" · "+(t.description||"Невозможно подтвердить остаток километров"),
     "approved-shipments",t.order_code,t.created_at));
  }
 }else errors.push("Задачи по документам ВЭД");
 return {tasks,total:Math.max(total,tasks.length),errors,supported:true};
}
async function fetchTask2(role){
 const d=await get("/api/task2?pending=1");
 if(d.pendingProjection!==true||!Array.isArray(d.items)||!Array.isArray(d.tasks))throw Error("Unexpected assignment projection");
 const rows=d.items.filter(x=>x&&x.order_code&&x.process_status!=="completed");
 const byOrder=new Map(rows.map(x=>[x.order_code,x])),tasks=[],errors=[];
 const assignedLogin=String(d.viewer||"").trim().toLowerCase();
 for(const x of rows){
  if(role==="carrier"&&x.process_status==="awaiting_take"){
   tasks.push(makeTask("take:"+x.order_code,word("take"),x.registration_no||x.order_code,"approved-shipments",x.order_code,x.created));
  }else if(role==="carrier"&&x.departure_required===true){
   tasks.push(makeTask("departure:"+x.order_code,word("departure"),x.registration_no||x.order_code,"approved-shipments",x.order_code,""));
  }
 }
 for(const t of d.tasks){
  const x=byOrder.get(t.order_code);if(!x||x.process_status==="awaiting_take"||!isOpen(t.status))continue;
  if(role==="logistic"){
   if(t.assigned_role!=="logistic"||!docTasks.has(t.task_type))continue;
   if(t.assigned_login&&String(t.assigned_login).toLowerCase()!==assignedLogin)continue;
   tasks.push(makeTask("ved:"+t.id,t.task_type==="ved_request_logistic"?"Предоставить документы ВЭД":word("ved"),(x.registration_no||x.order_code)+" · "+(t.description||t.task_type),"approved-shipments",x.order_code,t.created_at));
  }else if(role==="carrier"){
   if(t.assigned_role!=="carrier"||t.task_type!=="container_number")continue;
   tasks.push(makeTask("carrier:"+t.id,word("carrier"),(x.registration_no||x.order_code)+" · "+(t.description||""),"approved-shipments",x.order_code,t.created_at));
  }
 }
 if(d.limited)errors.push("Не все перевозки проверены");
 return {tasks,total:tasks.length,errors,supported:true};
}
async function fetchCarrier(){
 // This home panel is an execution inbox, NOT a quote-invitation list.
 // /api/task2?pending=1 returns only the authenticated carrier's awarded
 // shipments, guarded server-side by the winning offer selection.
 // Other carriers' wins, open tenders and unawarded invitations belong in
 // "Мои заявки" / "Мои предложения", never in executable tasks.
 try{
  const work=await fetchTask2("carrier");
  return {tasks:work.tasks,total:work.tasks.length,errors:work.errors,supported:true};
 }catch(_){
  // Fail closed: never fall back to invitations or another carrier's tasks.
  return {tasks:[],total:0,errors:["Исполнение выигранных перевозок"],supported:true};
 }
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
async function fetchAssigned(){
 const d=await get("/api/pending-tasks");
 if(!Array.isArray(d.items))throw Error("Missing assigned tasks");
 const tasks=d.items.filter(t=>isOpen(t.status)).map(t=>({...makeTask("assigned:"+t.id,t.description,t.order_code+" · "+(t.registration_no||"")+" · Bitrix "+(t.bitrix_task||""),"approved-shipments",t.order_code,t.created_at),inline:true}));
 return {tasks,total:Number(d.total)||tasks.length,errors:d.limited?["Показаны первые 200 назначений"]:[],supported:true};
}
async function loadRole(role){
 if(role==="owner")return fetchOwner();
 if(role==="carrier")return fetchCarrier();
 if(role==="logistic")return fetchTask2("logistic");
 if(role==="supplier"||role==="designer")return fetchSupplier(role);
 return fetchAssigned();
}
const state={visible:5,role:"",items:[],total:0,errors:[],supported:false,loading:false,loaded:false,updated:0,request:0};
let scheduled=false,refreshing=false;
function homeTarget(){
 const role=state.role;
 if(!roles.has(role))return null;
 const variants=role==="logistic"?["logistic","ved"]:role==="designer"?["designer","content-manager"]: [role];
 const standalone=document.querySelector('.sw-cabinet[data-cabinet-role="'+role+'"] .sw-page');
 if(standalone)return standalone;
 if(["content","purchasing","certification"].includes(role))return document.querySelector("#root main.card");
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
const processFaq={
 ru:{title:"FAQ · Работа с назначениями",owner:"В разделе «Управление процессами» выберите перевозки, поставщиков и дизайнеров или блокировки ставок. Доступны только действия, разрешённые сервером. Укажите причину и подтвердите изменение. При конфликте обновите данные. Решение о риске не заменяет проверки и не снимает обязательные блокировки.",carrier:"Выполняйте собственные задания в карточке выигранной перевозки. Если владелец возвращает запрос документов, проверьте его текущий статус и предоставьте необходимые документы. Снятие зависшей подготовки ставки владельцем не назначает победителя.",logistic:"Выполняйте адресные задания в карточке перевозки. При переназначении доступ к заданию переходит новому исполнителю. Если запрос открыт повторно, проверьте документы и актуальное назначение.",supplier:"Выполняйте свои заказы в разделе поставщика. Возврат на исправление означает повторную подачу обязательного комплекта. При аннулировании или переназначении обновите список и обратитесь к владельцу.",designer:"Работайте с назначенным заданием. При возврате комплекта поставщику дождитесь повторной подачи. Отменённое задание не открывается автоматически: его восстановление выполняет владелец.",assigned:"Этот список показывает существующие назначения для вашей роли и логина. Он не создаёт и не завершает задания. Для изменения полномочий или решения по зависшему назначению обратитесь к владельцу."},
 en:{title:"FAQ · Assigned work",owner:"In Process control, select Shipments, Suppliers and designers, or Quote preparation locks. Only server-authorized actions are available. Provide a reason and confirm. Refresh on conflict. Recording risk does not replace checks or remove mandatory blockers.",carrier:"Complete your own assignments in the awarded shipment. If the owner reopens a document request, check its current status and provide the required documents. Resolving a stuck quote preparation does not select a winner.",logistic:"Complete addressed assignments in the shipment. Reassignment transfers task access to the new assignee. If a request is reopened, check its documents and current assignment.",supplier:"Complete your own orders in the supplier section. Return for correction requires resubmission of the mandatory package. Refresh after cancellation or reassignment and contact the owner.",designer:"Work on your assigned task. When a package is returned to the supplier, wait for resubmission. Cancelled tasks are not automatically reopened; the owner restores them.",assigned:"This list shows existing assignments for your role and login. It does not create or complete tasks. Contact the owner for a decision on stalled assignments or changes to permissions."},
 zh:{title:"常见问题 · 已分配任务",owner:"在流程管理中选择运输、供应商与设计师或报价准备锁定。仅可执行服务端授权的操作。填写原因并确认；发生冲突时刷新。风险记录不替代检查，也不解除强制限制。",carrier:"在中标运输中完成自己的任务。所有者重新打开文件请求后，请检查当前状态并提交所需文件。解除报价准备锁定不代表选定中标人。",logistic:"在运输中完成指定任务。重新分配后，新负责人获得任务访问权限。请求重新打开时，请检查文件及当前分配情况。",supplier:"在供应商区域完成自己的订单。退回修改后需重新提交必需文件。取消或重新分配后请刷新列表并联系所有者。",designer:"处理已分配给您的任务。文件退回供应商后，请等待重新提交。已取消的任务不会自动重新打开，由所有者恢复。",assigned:"此列表显示您所属角色和账户的现有任务，不创建或完成任务。任务停滞或权限需要更改时，请联系所有者。"}
};
function processFaqHtml(role,lang){
 const t=processFaq[lang]||processFaq.ru;
 const key=["content","purchasing","certification"].includes(role)?"assigned":role;
 return Object.hasOwn(t,key)&&key!=="title"&&key!=="assigned"||["content","purchasing","certification"].includes(role)?'<details class="lw-process-faq"><summary>'+esc(t.title)+'</summary><p>'+esc(t[key])+'</p></details>':"";
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
 const displayed=items.slice(0,state.visible);
 const rows=displayed.map(task=>task.inline?'<li><details><summary><strong>'+esc(task.label)+'</strong></summary><p>'+esc(task.detail)+'</p></details></li>':'<li><a href="#'+esc(task.route)+'" data-lw-task-open="'+esc(task.route)+'" data-lw-order="'+esc(task.order)+'"><span><strong>'+esc(task.label)+'</strong><small>'+esc(task.detail)+'</small></span><span class="lw-pending-arrow" aria-hidden="true">›</span></a></li>').join("");
 const more=count>displayed.length?'<div class="lw-pending-more">'+esc(word("more"))+" "+displayed.length+" "+esc(word("of"))+" "+count+(items.length>displayed.length?' <button type="button" data-lw-tasks-more>'+esc(word("showMore"))+'</button>':"")+'</div>':"";
 root.innerHTML='<div class="lw-pending-head"><div><h3>'+esc(word("heading"))+'</h3><span class="lw-pending-count" aria-label="'+esc(word("heading"))+'">'+(state.loading?"…":state.supported?count:"—")+'</span></div><button type="button" data-lw-tasks-refresh>'+esc(word("refresh"))+'</button></div>'+
  (rows?'<ul>'+rows+'</ul>':"")+status+more+processFaqHtml(state.role,language());
 root.dataset.taskRole=state.role;
}
async function refresh(force=false){
 if(refreshing)return;
 const now=Date.now();
 if(!force&&state.loaded&&now-state.updated<60000)return;
 refreshing=true;state.loading=true;
 if(force){state.visible=5;state.items=[];state.total=0;state.errors=[];state.loaded=false;}
 paint();
 let token=++state.request;
 try{
  const session=await get("/api/session");
  const role=toRole(session.authenticated?session.role:"");
  if(!roles.has(role)){clearControl();state.role="";state.items=[];state.total=0;state.loaded=false;
   document.getElementById(ROOT_ID)?.remove();return;}
  if(role!==state.role){clearControl();state.visible=5;state.role=role;state.items=[];state.total=0;state.loaded=false;state.errors=[];state.supported=false;}
  paint();
  const result=await loadRole(role);
  if(token!==state.request)return;
  state.items=result.tasks||[];state.total=result.total||0;state.errors=result.errors||[];
  state.supported=result.supported;state.loaded=true;state.updated=Date.now();
 }catch(_){
  clearControl();
  state.items=[];state.total=0;state.errors=["network"];state.supported=true;state.loaded=true;state.updated=Date.now();
 }finally{state.loading=false;refreshing=false;paint();}
}

const CONTROL_ID="lw-owner-process-control";
const control={seq:0,page:null,busy:false,notice:"",scope:"shipments"};
const controlWords={
 ru:{title:"Управление процессами · Владелец",help:"Открытые назначения по перевозкам всех ролей. Доступные действия определяет сервер. Открытые и доступные для повторного открытия запросы документов можно перевести только в разрешённую стадию. Финансы и фактические этапы перевозки подтверждаются в исходных карточках.",load:"Проверить назначения",loading:"Читаем назначения…",empty:"Открытых назначений нет.",failed:"Не удалось подтвердить назначения. Обновите список.",next:"Следующая страница",back:"Первая страница",recipient:"Новый логист",reason:"Причина переназначения (10–1000 символов)",confirm:"Подтверждаю перенос адресного задания",reassign:"Переназначить",saved:"Исполнитель изменён. Событие записано в аудит.",stale:"Данные изменились. Обновите назначения.",native:"Действие через исходный процесс",inactive:"Заявка неактивна или изменена",award:"Победитель изменён или не подтверждён",shipment:"Перевозка не в активном исполнении",closed:"Задача закрыта",role:"Роль",assignee:"Исполнитель",status:"Статус",select:"Выбрать",showing:"Показано",open:"Открыть перевозку",ready:"Доступны подтверждённые сервером действия",document_start:"Начать работу",document_return:"Вернуть в открытые",document_complete:"Закрыть запрос документов",document_reopen:"Повторно открыть запрос",documentAction:"Действие с заданием",documentReason:"Причина изменения (10–1000 символов)",documentConfirm:"Подтверждаю изменение стадии задания",documentApply:"Выполнить",documentSaved:"Стадия задания изменена. Событие записано в аудит.",riskTitle:"Решение по риску",riskAccept:"Принять риск",riskWithdraw:"Отозвать решение",riskReason:"Обоснование риска (10–1000 символов)",riskConfirm:"Подтверждаю решение. Оно не снимает блокировки и не заменяет проверки.",riskSaved:"Решение по риску сохранено в журнале.",riskHistory:"История решений (до 5 последних)",riskStale:"По прежней редакции задания",riskNoHistory:"Решений пока нет.",partners:"Поставщики и дизайнеры",shipments:"Перевозки",partnerSupplier:"Поставщик",partnerDesigner:"Дизайнер",partnerOrders:"Заказов в источнике",partnerOpen:"Открыть штатный раздел",partnerWaiting:"Ожидает повторной подачи поставщиком",partnerReopen:"Возврат поставщику на исправление",partnerEdit:"Переназначить исполнителя",partnerCancel:"Аннулировать задание",partnerRestore:"Восстановить задание",partnerRecipient:"Новый исполнитель",partnerConfirm:"Подтверждаю изменение задания и последствия",partnerSaved:"Задание изменено, решение записано в аудит.",partnerRevision:"Редакция",partnerEmpty:"Записей поставок нет.",drafts:"Блокировки ставок",draftEmpty:"Активных блокировок подготовки ставок нет.",draftCarrier:"Перевозчик",draftUnlock:"Снять блокировку подготовки",draftReason:"Причина снятия (10–1000 символов)",draftConfirm:"Подтверждаю снятие зависшей подготовки. Победитель не назначается.",draftSaved:"Подготовка разблокирована, решение записано в аудит."},
 en:{title:"Process control · Owner",help:"Open shipment assignments across roles. The server determines available actions. Open and eligible completed document requests can use approved task transitions. Finance and physical shipment milestones remain in native workflows.",load:"Check assignments",loading:"Reading assignments…",empty:"No open assignments.",failed:"Assignments could not be verified. Refresh the list.",next:"Next page",back:"First page",recipient:"New logistics employee",reason:"Reason (10–1000 characters)",confirm:"Confirm transfer of this assigned task",reassign:"Reassign",saved:"Assignment changed and audited.",stale:"Data changed. Refresh assignments.",native:"Use native workflow",inactive:"Request inactive or changed",award:"Award changed or unverified",shipment:"Shipment not active",closed:"Task closed",role:"Role",assignee:"Assignee",status:"Status",select:"Select",showing:"Showing",open:"Open shipment",ready:"Server-authorized actions available",document_start:"Start work",document_return:"Return to open",document_complete:"Close document request",document_reopen:"Reopen document request",documentAction:"Task action",documentReason:"Reason for change (10–1000 characters)",documentConfirm:"Confirm task transition",documentApply:"Apply",documentSaved:"Task transition recorded in audit.",riskTitle:"Risk decision",riskAccept:"Accept risk",riskWithdraw:"Withdraw decision",riskReason:"Risk rationale (10–1000 characters)",riskConfirm:"Confirm decision. It does not remove blockers or replace checks.",riskSaved:"Risk decision recorded.",riskHistory:"Decision history (latest five)",riskStale:"Previous task revision",riskNoHistory:"No decisions yet.",partners:"Suppliers and designers",shipments:"Shipments",partnerSupplier:"Supplier",partnerDesigner:"Designer",partnerOrders:"Orders in source",partnerOpen:"Open native section",partnerWaiting:"Waiting for supplier resubmission",partnerReopen:"Return to supplier for correction",partnerEdit:"Reassign task",partnerCancel:"Cancel task",partnerRestore:"Restore task",partnerRecipient:"New assignee",partnerConfirm:"Confirm task change and its consequences",partnerSaved:"Task updated and audited.",partnerRevision:"Revision",partnerEmpty:"No supplier orders.",drafts:"Quote preparation locks",draftEmpty:"No active quote preparation locks.",draftCarrier:"Carrier",draftUnlock:"Resolve preparation lock",draftReason:"Reason (10–1000 characters)",draftConfirm:"Confirm resolution of stuck preparation. No winner will be selected.",draftSaved:"Preparation unlocked and audited."},
 zh:{title:"流程管理 · 所有者",help:"查看各角色未完成运输任务。服务端决定可执行操作。待办及允许重新打开的文件请求仅可执行授权的任务转换。财务及实际运输阶段仍由原流程确认。",load:"检查任务",loading:"正在读取任务…",empty:"暂无未完成任务。",failed:"无法核实任务，请刷新。",next:"下一页",back:"第一页",recipient:"新物流人员",reason:"重新分配原因（10–1000 字符）",confirm:"确认转移此指定任务",reassign:"重新分配",saved:"任务已重新分配并记录审计。",stale:"数据已更改，请刷新任务。",native:"使用原流程",inactive:"申请无效或已更改",award:"中标人已更改或未确认",shipment:"运输未处于执行状态",closed:"任务已关闭",role:"角色",assignee:"负责人",status:"状态",select:"选择",showing:"显示",open:"打开运输",ready:"可执行服务端授权的操作",document_start:"开始工作",document_return:"退回待办",document_complete:"关闭文件请求",document_reopen:"重新打开文件请求",documentAction:"任务操作",documentReason:"修改原因（10–1000 字符）",documentConfirm:"确认修改任务阶段",documentApply:"执行",documentSaved:"任务阶段已修改并记录审计。",riskTitle:"风险决定",riskAccept:"接受风险",riskWithdraw:"撤回决定",riskReason:"风险说明（10–1000 字符）",riskConfirm:"确认决定。不解除限制或替代检查。",riskSaved:"风险决定已记录。",riskHistory:"决定记录（最近五条）",riskStale:"旧任务版本",riskNoHistory:"暂无决定。",partners:"供应商与设计师",shipments:"运输",partnerSupplier:"供应商",partnerDesigner:"设计师",partnerOrders:"来源订单数",partnerOpen:"打开原流程",partnerWaiting:"等待供应商重新提交",partnerReopen:"退回供应商修改",partnerEdit:"重新分配任务",partnerCancel:"取消任务",partnerRestore:"恢复任务",partnerRecipient:"新负责人",partnerConfirm:"确认任务变更及其后果",partnerSaved:"任务已更新并记录审计。",partnerRevision:"版本",partnerEmpty:"暂无供应商订单。",drafts:"报价准备锁定",draftEmpty:"没有活动的报价准备锁定。",draftCarrier:"承运人",draftUnlock:"解除准备锁定",draftReason:"原因（10–1000 字符）",draftConfirm:"确认解除停滞的准备锁定，不选择中标人。",draftSaved:"已解除准备锁定并记录审计。"}
};
function controlText(){return controlWords[language()]||controlWords.ru;}
function controlReason(code,t){return ({INACTIVE_REQUEST:t.inactive,AWARD_CHANGED_OR_MISSING:t.award,SHIPMENT_NOT_ACTIVE:t.shipment,USE_NATIVE_WORKFLOW:t.native,TASK_NOT_OPEN:t.closed})[code]||t.native;}
function controlForm(task,people,t){
 if(task.blocker||!Array.isArray(task.actions)||!task.actions.includes("reassign_logistic")||!task.revision)return "";
 const old=String(task.assigned_login||"").toLowerCase(),requester=String(task.requested_by||"").toLowerCase();
 const options=people.filter(p=>p.login&&![old,requester].includes(String(p.login).toLowerCase())).map(p=>'<option value="'+esc(p.login)+'">'+esc(p.name||p.login)+'</option>').join("");
 if(!options)return "";
 return '<form data-lw-control-task="'+esc(task.id)+'"><label>'+esc(t.recipient)+'<select name="assignedLogin" required><option value="">'+esc(t.select)+'</option>'+options+'</select></label><label>'+esc(t.reason)+'<textarea name="reason" minlength="10" maxlength="1000" required rows="3"></textarea></label><label><input name="confirmed" type="checkbox" required> '+esc(t.confirm)+'</label><button type="submit">'+esc(t.reassign)+'</button></form>';
}
const documentOperations=["document_start","document_return","document_complete","document_reopen"];
function documentControlForm(task,t){
 if(task.blocker||!Array.isArray(task.actions)||!task.revision)return "";
 const options=documentOperations.filter(action=>task.actions.includes(action)).map(action=>'<option value="'+esc(action)+'">'+esc(t[action])+'</option>').join("");
 if(!options)return "";
 return '<form data-lw-control-document="'+esc(task.id)+'"><label>'+esc(t.documentAction)+'<select name="operation" required><option value="">'+esc(t.select)+'</option>'+options+'</select></label><label>'+esc(t.documentReason)+'<textarea name="reason" minlength="10" maxlength="1000" required rows="3"></textarea></label><label><input name="confirmed" type="checkbox" required> '+esc(t.documentConfirm)+'</label><button type="submit">'+esc(t.documentApply)+'</button></form>';
}
function riskControlForm(task,t){
 const history=Array.isArray(task.riskHistory)?task.riskHistory:[];
 const log=history.length?'<details><summary>'+esc(t.riskHistory)+'</summary><ul>'+history.map(e=>'<li>'+esc(e.decision==="withdraw"?t.riskWithdraw:t.riskAccept)+' · '+esc(e.actor)+' · '+esc(e.createdAt)+'<p>'+esc(e.reason)+'</p>'+(e.revision!==task.revision?'<small>'+esc(t.riskStale)+'</small>':"")+'</li>').join("")+'</ul></details>':'<p>'+esc(t.riskNoHistory)+'</p>';
 if(task.riskRecordAllowed!==true||!task.revision)return history.length?log:"";
 const withdrawal=history[0]?.decision==="accept"?'<option value="withdraw">'+esc(t.riskWithdraw)+'</option>':"";
 return log+'<form data-lw-control-risk="'+esc(task.id)+'"><label>'+esc(t.riskTitle)+'<select name="decision" required><option value="">'+esc(t.select)+'</option><option value="accept">'+esc(t.riskAccept)+'</option>'+withdrawal+'</select></label><label>'+esc(t.riskReason)+'<textarea name="reason" minlength="10" maxlength="1000" required rows="3"></textarea></label><label><input name="confirmed" type="checkbox" required> '+esc(t.riskConfirm)+'</label><button type="submit">'+esc(t.documentApply)+'</button></form>';
}
const partnerOperations={supplier:["reopen","edit","cancel","restore"],designer:["design_edit","design_cancel","design_restore"]};
function partnerControlForms(task,t,people=[]){
 if(task?.source!=="partners"||!task.id||!task.orderId||task.revision===null||!Number.isSafeInteger(Number(task.revision))||Number(task.revision)<0||!Object.hasOwn(partnerOperations,task.role))return "";
 const allowed=Array.isArray(task.nativeActions)?task.nativeActions:[];
 const label={reopen:t.partnerReopen,edit:t.partnerEdit,design_edit:t.partnerEdit,cancel:t.partnerCancel,design_cancel:t.partnerCancel,restore:t.partnerRestore,design_restore:t.partnerRestore};
 const options=people.filter(p=>p.role===task.role&&p.login&&String(p.login).toLowerCase()!==String(task.assignee||"").toLowerCase()).map(p=>'<option value="'+esc(p.login)+'">'+esc(p.name||p.login)+'</option>').join("");
 return partnerOperations[task.role].filter(a=>allowed.includes(a)).map(action=>{
  const reassign=action==="edit"||action==="design_edit";
  if(reassign&&!options)return "";
  return '<details><summary>'+esc(label[action])+'</summary><form data-lw-control-partner="'+esc(task.id)+'" data-operation="'+action+'">'+(reassign?'<label>'+esc(t.partnerRecipient)+'<select name="recipient" required><option value="">'+esc(t.select)+'</option>'+options+'</select></label>':"")+'<label>'+esc(t.documentReason)+'<textarea name="reason" minlength="10" maxlength="1000" required rows="3"></textarea></label><label><input name="confirmed" type="checkbox" required> '+esc(t.partnerConfirm)+'</label><button type="submit">'+esc(label[action])+'</button></form></details>';
 }).join("");
}
function partnerControlRow(task,t,people=[]){
 if(task?.source!=="partners"||!["supplier","designer"].includes(task.role))return "";
 const route=task.role==="supplier"?"supplier-orders":"content-tasks";
 if(task.route!==route)return "";
 const label=task.role==="supplier"?t.partnerSupplier:t.partnerDesigner;
 const detail=task.blocker==="WAITING_SUPPLIER"?t.partnerWaiting:task.role==="supplier"&&task.nativeActions?.includes("reopen")?t.partnerReopen:t.native;
 return '<li><details><summary><strong>'+esc(task.order_code)+' · '+esc(label)+'</strong><small> · '+esc(task.status)+'</small></summary><p>'+esc(task.description)+'</p><p>'+esc(t.assignee)+': '+esc(task.assignee||"—")+' · '+esc(t.partnerRevision)+': '+esc(task.revision??"—")+'</p><p>'+esc(detail)+'</p><p><a href="#'+route+'">'+esc(t.partnerOpen)+'</a></p>'+partnerControlForms(task,t,people)+'</details></li>';
}
function draftControlRow(task,t){
 if(task?.status!=="active"||!task.id||!task.order_code||!task.notification_id)return "";
 const revision=Number(task.revision),allowed=task.unlockAllowed===true&&task.revision!==null&&Number.isSafeInteger(revision)&&revision>=0;
 return '<li><details><summary><strong>'+esc(task.order_code)+'</strong><small> · '+esc(task.carrier_login)+' · '+esc(task.status)+'</small></summary><p>'+esc(t.draftCarrier)+': '+esc(task.carrier_login)+' · '+esc(t.partnerRevision)+': '+esc(task.revision)+'</p><p><a href="#offers">'+esc(t.partnerOpen)+'</a></p>'+(allowed?'<form data-lw-control-draft="'+esc(task.id)+'"><label>'+esc(t.draftReason)+'<textarea name="reason" minlength="10" maxlength="1000" required rows="3"></textarea></label><label><input name="confirmed" type="checkbox" required> '+esc(t.draftConfirm)+'</label><button type="submit">'+esc(t.draftUnlock)+'</button></form>':"")+'</details></li>';
}
function paintControl(){
 const host=document.getElementById(CONTROL_ID);if(!host||state.role!=="owner")return;
 const t=controlText(),p=control.page;
 let body=control.busy?'<p role="status">'+esc(t.loading)+'</p>':"";
 if(control.notice)body+='<p role="status">'+esc(control.notice)+'</p>';
 if(p){
  if(p.scope==="drafts"){
   body+='<p>'+esc(t.showing)+' '+p.items.length+' / '+esc(p.total)+'</p>';
   if(!p.items.length)body+='<p>'+esc(t.draftEmpty)+'</p>';
   body+='<ul>'+p.items.map(task=>draftControlRow(task,t)).join("")+'</ul>';
  }else if(p.scope==="partners"){
   body+='<p>'+esc(t.partnerOrders)+': '+esc(p.totalOrders)+'</p>';
   if(!p.items.length)body+='<p>'+esc(t.partnerEmpty)+'</p>';
   body+='<ul>'+p.items.map(task=>partnerControlRow(task,t,p.recipients||[])).join("")+'</ul>';
  }else{
  const items=p.items,people=p.recipients;
  body+='<p>'+esc(t.showing)+' '+items.length+' / '+esc(p.total)+'</p>';
  if(!items.length)body+='<p>'+esc(t.empty)+'</p>';
  body+='<ul>'+items.map(task=>'<li><details><summary><strong>'+esc(task.order_code)+' · '+esc(task.task_type)+'</strong><small> · '+esc(task.assigned_role)+' · '+esc(task.status)+'</small></summary><p>'+esc(task.description)+'</p><p>'+esc(t.role)+': '+esc(task.assigned_role)+' · '+esc(t.assignee)+': '+esc(task.assigned_login||"—")+'</p><p>'+esc(task.blocker?controlReason(task.blocker,t):t.ready)+'</p>'+(task.blocker==='INACTIVE_REQUEST'||task.blocker==='AWARD_CHANGED_OR_MISSING'?'':'<p><a href="#approved-shipments" data-lw-control-open="'+esc(task.order_code)+'">'+esc(t.open)+'</a></p>')+controlForm(task,people,t)+documentControlForm(task,t)+riskControlForm(task,t)+'</details></li>').join("")+'</ul>';
  }
  if(p.offset>0)body+='<button type="button" data-lw-control-load="0">'+esc(t.back)+'</button>';
  if(Number.isInteger(p.nextOffset))body+='<button type="button" data-lw-control-load="'+p.nextOffset+'">'+esc(t.next)+'</button>';
 }
 host.querySelector("[data-lw-control-body]").innerHTML=body;
}
function clearControl(){
 control.seq++;control.page=null;control.busy=false;control.notice="";control.scope="shipments";
 document.getElementById(CONTROL_ID)?.remove();
}
function mountControl(){
 if(state.role!=="owner"){if(document.getElementById(CONTROL_ID))clearControl();return;}
 const home=homeTarget();if(!home)return;
 let host=document.getElementById(CONTROL_ID);
 if(host&&home.contains(host))return;
 if(host)clearControl();
 const t=controlText();
 host=document.createElement("section");host.id=CONTROL_ID;host.className="lw-pending-task-box";
 host.innerHTML='<details><summary><strong>'+esc(t.title)+'</strong></summary><p>'+esc(t.help)+'</p><button type="button" data-lw-control-load="0">'+esc(t.load)+'</button> <button type="button" data-lw-control-scope="shipments">'+esc(t.shipments)+'</button> <button type="button" data-lw-control-scope="partners">'+esc(t.partners)+'</button> <button type="button" data-lw-control-scope="drafts">'+esc(t.drafts)+'</button><div data-lw-control-body></div></details>';
 home.prepend(host);
}
async function loadControl(offset=0,notice="",scope=control.scope){
 if(state.role!=="owner"||control.busy)return;
 if(!["shipments","partners","drafts"].includes(scope))return;
 const seq=++control.seq;control.busy=true;control.page=null;control.notice=notice;control.scope=scope;paintControl();
 try{
  const p=await get("/api/pending-tasks?ownerControl=1&scope="+scope+"&offset="+offset);
  if(p.ownerControl!==true||p.ok!==true||!Array.isArray(p.items))throw Error("Owner control unavailable");
  if(scope==="drafts"?p.scope!=="drafts":scope==="partners"?p.scope!=="partners":["drafts","partners"].includes(p.scope)||!Array.isArray(p.recipients))throw Error("Owner scope unavailable");
  if(seq!==control.seq||state.role!=="owner")return;
  control.page={...p,offset,scope};
 }catch{if(seq===control.seq)control.notice=controlText().failed;}
 finally{if(seq===control.seq){control.busy=false;paintControl();}}
}
async function reassignControl(form){
 if(control.busy||state.role!=="owner"||!control.page)return;
 const task=control.page.items.find(t=>t.id===form.dataset.lwControlTask);
 if(!task||task.blocker||!task.actions?.includes("reassign_logistic"))return;
 const values=new FormData(form),reason=String(values.get("reason")||"").trim(),assignedLogin=String(values.get("assignedLogin")||"");
 if(reason.length<10||reason.length>1000||!assignedLogin||values.get("confirmed")!=="on")return;
 const seq=++control.seq,offset=control.page.offset;
 control.busy=true;form.querySelector('button[type="submit"]').disabled=true;
 try{
  const response=await fetch("/api/task2",{method:"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"owner_reassign_logistic",order:task.order_code,taskId:task.id,expectedRevision:task.revision,assignedLogin,reason,confirmed:true})});
  const data=await response.json();
  if(seq!==control.seq||state.role!=="owner")return;
  control.busy=false;
  await loadControl(offset,response.ok&&data.ok===true?controlText().saved:data.error==="PROCESS_STALE"?controlText().stale:controlText().failed);
 }catch{if(seq===control.seq){control.busy=false;control.notice=controlText().failed;paintControl();}}
 finally{if(seq===control.seq)control.busy=false;}
}
async function transitionControl(form){
 if(control.busy||state.role!=="owner"||!control.page)return;
 const task=control.page.items.find(t=>t.id===form.dataset.lwControlDocument);
 const values=new FormData(form),operation=String(values.get("operation")||""),reason=String(values.get("reason")||"").trim();
 if(!task||task.blocker||!documentOperations.includes(operation)||!task.actions?.includes(operation)||!task.revision||reason.length<10||reason.length>1000||values.get("confirmed")!=="on")return;
 const seq=++control.seq,offset=control.page.offset;
 control.busy=true;form.querySelector('button[type="submit"]').disabled=true;
 try{
  const response=await fetch("/api/task2",{method:"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"owner_transition_document_task",order:task.order_code,taskId:task.id,expectedRevision:task.revision,operation,reason,confirmed:true})});
  const data=await response.json();
  if(seq!==control.seq||state.role!=="owner")return;
  control.busy=false;
  await loadControl(offset,response.ok&&data.ok===true?controlText().documentSaved:data.error==="PROCESS_STALE"?controlText().stale:controlText().failed);
 }catch{if(seq===control.seq){control.busy=false;control.notice=controlText().failed;paintControl();}}
 finally{if(seq===control.seq)control.busy=false;}
}
async function riskControl(form){
 if(control.busy||state.role!=="owner"||!control.page)return;
 const task=control.page.items.find(t=>t.id===form.dataset.lwControlRisk),values=new FormData(form),decision=String(values.get("decision")||""),reason=String(values.get("reason")||"").trim();
 if(!task||task.riskRecordAllowed!==true||!task.revision||!["accept","withdraw"].includes(decision)||reason.length<10||reason.length>1000||values.get("confirmed")!=="on")return;
 if(decision==="withdraw"&&task.riskHistory?.[0]?.decision!=="accept")return;
 if(typeof globalThis.crypto?.randomUUID!=="function"){control.notice=controlText().failed;paintControl();return;}
 const requestId=globalThis.crypto.randomUUID(),seq=++control.seq,offset=control.page.offset;
 control.busy=true;form.querySelector('button[type="submit"]').disabled=true;
 try{
  const response=await fetch("/api/task2",{method:"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"owner_record_process_risk",order:task.order_code,taskId:task.id,expectedRevision:task.revision,requestId,decision,reason,confirmed:true})});
  const data=await response.json();if(seq!==control.seq||state.role!=="owner")return;
  control.busy=false;await loadControl(offset,response.ok&&data.ok===true?controlText().riskSaved:data.error==="PROCESS_STALE"?controlText().stale:controlText().failed);
 }catch{if(seq===control.seq){control.busy=false;control.notice=controlText().failed;paintControl();}}
 finally{if(seq===control.seq)control.busy=false;}
}
async function recoverPartner(form){
 if(control.busy||state.role!=="owner"||control.page?.scope!=="partners")return;
 const task=control.page.items.find(t=>t.id===form.dataset.lwControlPartner),action=form.dataset.operation,values=new FormData(form),reason=String(values.get("reason")||"").trim(),recipient=String(values.get("recipient")||""),revision=Number(task?.revision);
 if(!task||task.source!=="partners"||!task.orderId||!Object.hasOwn(partnerOperations,task.role)||!partnerOperations[task.role].includes(action)||!task.nativeActions?.includes(action)||task.revision===null||!Number.isSafeInteger(revision)||revision<0||reason.length<10||reason.length>1000||values.get("confirmed")!=="on")return;
 const reassign=action==="edit"||action==="design_edit";
 if(reassign&&(!recipient||String(task.assignee||"").toLowerCase()===recipient.toLowerCase()||!control.page.recipients?.some(p=>p.role===task.role&&p.login===recipient)))return;
 const body={action,id:task.orderId,expectedRevision:revision,reason,confirmed:true,ownerProcess:true};
 if(reassign)body[task.role==="supplier"?"supplier":"assignee"]=recipient;
 const seq=++control.seq,offset=control.page.offset;control.busy=true;form.querySelector('button[type="submit"]').disabled=true;
 try{
  const response=await fetch("/api/supplier-orders",{method:"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();if(seq!==control.seq||state.role!=="owner")return;
  control.busy=false;await loadControl(offset,response.ok&&data.ok===true?controlText().partnerSaved:response.status===409?controlText().stale:controlText().failed,"partners");
 }catch{if(seq===control.seq){control.busy=false;control.notice=controlText().failed;paintControl();}}
 finally{if(seq===control.seq)control.busy=false;}
}
async function unlockDraft(form){
 if(control.busy||state.role!=="owner"||control.page?.scope!=="drafts")return;
 const task=control.page.items.find(t=>t.id===form.dataset.lwControlDraft),values=new FormData(form),reason=String(values.get("reason")||"").trim(),revision=Number(task?.revision);
 if(!task||task.status!=="active"||task.unlockAllowed!==true||!task.notification_id||!task.order_code||task.revision===null||!Number.isSafeInteger(revision)||revision<0||reason.length<10||reason.length>1000||values.get("confirmed")!=="on")return;
 const seq=++control.seq,offset=control.page.offset;control.busy=true;form.querySelector('button[type="submit"]').disabled=true;
 try{
  const response=await fetch("/api/late-bid-drafts",{method:"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"resolve",order:task.order_code,notificationId:task.notification_id,expectedRevision:revision,reason,confirmed:true})});
  const data=await response.json();if(seq!==control.seq||state.role!=="owner")return;
  control.busy=false;await loadControl(offset,response.ok&&data.ok===true&&data.status==="resolved"?controlText().draftSaved:response.status===409?controlText().stale:controlText().failed,"drafts");
 }catch{if(seq===control.seq){control.busy=false;control.notice=controlText().failed;paintControl();}}
 finally{if(seq===control.seq)control.busy=false;}
}
document.addEventListener("submit",event=>{
 const partnerForm=event.target.closest?.("#"+CONTROL_ID+" form[data-lw-control-partner]");
 if(partnerForm){event.preventDefault();void recoverPartner(partnerForm);return;}
 const draftForm=event.target.closest?.("#"+CONTROL_ID+" form[data-lw-control-draft]");
 if(draftForm){event.preventDefault();void unlockDraft(draftForm);return;}
 const riskForm=event.target.closest?.("#"+CONTROL_ID+" form[data-lw-control-risk]");
 if(riskForm){event.preventDefault();void riskControl(riskForm);return;}
 const documentForm=event.target.closest?.("#"+CONTROL_ID+" form[data-lw-control-document]");
 if(documentForm){event.preventDefault();void transitionControl(documentForm);return;}
 const form=event.target.closest?.("#"+CONTROL_ID+" form[data-lw-control-task]");
 if(!form)return;event.preventDefault();void reassignControl(form);
});
document.addEventListener("click",event=>{
 const scope=event.target.closest?.("#"+CONTROL_ID+" [data-lw-control-scope]");
 if(scope){event.preventDefault();void loadControl(0,"",scope.dataset.lwControlScope);return;}
 const load=event.target.closest?.("#"+CONTROL_ID+" [data-lw-control-load]");
 if(load){event.preventDefault();void loadControl(Number(load.dataset.lwControlLoad)||0);return;}
 const open=event.target.closest?.("#"+CONTROL_ID+" [data-lw-control-open]");
 if(open&&state.role==="owner")window.dispatchEvent(new CustomEvent("carrier-flow-open-execution",{detail:{order:open.dataset.lwControlOpen}}));
});

function mount(){
 mountControl();
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
 const moreButton=event.target.closest("#"+ROOT_ID+" [data-lw-tasks-more]");
 if(moreButton){event.preventDefault();state.visible+=5;paint();return;}
 const jump=event.target.closest("#"+ROOT_ID+" a[data-lw-task-open]");
 if(jump&&jump.dataset.lwOrder&&jump.dataset.lwTaskOpen==="approved-shipments"){
  window.dispatchEvent(new CustomEvent("carrier-flow-open-execution",{detail:{order:jump.dataset.lwOrder}}));
 }
});
document.addEventListener("DOMContentLoaded",()=>{refresh(true);queue();});
window.addEventListener("hashchange",()=>{refresh(!location.hash||location.hash==="#overview");queue();});
window.addEventListener("lw-tasks-changed",()=>refresh(true));
window.addEventListener("focus",()=>{if(Date.now()-state.updated>60000)refresh();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
document.addEventListener("freight-access-updated",()=>refresh(true));
new MutationObserver(queue).observe(document.getElementById("root")||document.documentElement,{childList:true,subtree:true});
refresh(true);
queue();
})();
