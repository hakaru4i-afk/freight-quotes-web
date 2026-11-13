/* OWNER-COMMAND-02 — approved dark Owner dashboard; staging only, reads existing APIs. */
(()=>{"use strict";
const ROOT_ID="lw-owner-command";
const routes=new Set(["overview","create-request","request-registry","offers","answers","tender-hub","approved-shipments","winner-chats","transport-claims","incident-journal","supplier-orders","content-tasks","management-reports","carrier-service","sla","site-monitor","team","access-levels","portal-feedback","help"]);
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const safeRoute=id=>routes.has(String(id))?String(id):"overview";
const isNumber=v=>typeof v==="number"&&Number.isFinite(v)||typeof v==="string"&&v.trim()!==""&&Number.isFinite(Number(v));
const fmt=v=>isNumber(v)?Number(v).toLocaleString("ru-RU"):"—";
const short=v=>String(v??"").trim().slice(0,90);
const localDate=v=>{if(!v)return "—";const d=new Date(v);return Number.isNaN(+d)?"—":d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Minsk"})};
const statusText=v=>({new:"Новая",open:"Открыта",accepted:"В работе",approved:"Допущена",selected:"Победитель выбран",awarded:"Победитель выбран",completed:"Завершено",archived:"Архив",annulled:"Аннулирована",pending:"Ожидает решения",active:"Активна",in_progress:"В работе",rejected:"Отклонена",no_response:"Нет ответа"})[String(v||"").toLowerCase()]||short(v)||"—";
const icon=s=>'<span class="lw-cc-icon" aria-hidden="true">'+s+'</span>';
let state={workload:null,registry:null,shipments:null,sl:null,development:null,errors:[],loading:false,tab:"requests",updated:null};
let queued=false,hasLoaded=false,inFlight=false;
function owner(){return document.querySelector('.cabinet-app[data-cabinet-role="owner"]')}
function overview(){return owner()?.querySelector('.cabinet-panel[data-section="overview"]')}
function visible(){const o=overview();return !!o&&!o.hidden}
function link(id,body,cls="",extra=""){return '<a class="'+cls+'" href="#'+safeRoute(id)+'" '+extra+'>'+body+'</a>'}
async function request(path){
 const response=await fetch(path,{cache:"no-store"});
 if(!response.ok)throw Error("HTTP "+response.status);
 return response.json();
}
function normalize(obj){
 return {
  workload:obj[0]?.status==="fulfilled"&&obj[0].value&&typeof obj[0].value==="object"?obj[0].value:null,
  registry:obj[1]?.status==="fulfilled"&&Array.isArray(obj[1].value?.items)?obj[1].value.items:null,
  shipments:obj[2]?.status==="fulfilled"&&Array.isArray(obj[2].value?.items)?obj[2].value.items:null,
  sl:obj[3]?.status==="fulfilled"&&Array.isArray(obj[3].value?.policies)?obj[3].value.policies:null,
  development:obj[4]?.status==="fulfilled"&&obj[4].value?.owner===true&&Array.isArray(obj[4].value?.items)?obj[4].value.items:null
 };
}
async function load(){
 if(inFlight||!visible())return;
 inFlight=true;state.loading=true;render();
 const names=["Нагрузка","Заявки","Перевозки","Service Level","Центр доработок"];
 try{
  const outcomes=await Promise.allSettled([
   request("/api/workload"),
   request("/api/registry"),
   request("/api/shipments"),
   request("/api/service-level?overview=1"),
   request("/api/portal-feedback")
  ]);
  const data=normalize(outcomes);
  state={...state,...data,errors:outcomes.flatMap((x,i)=>x.status==="rejected"?[names[i]+": "+(x.reason?.message||"недоступно")]:[]),updated:new Date(),loading:false};
  hasLoaded=true;
 }catch(e){state.errors=[String(e?.message||e)];state.loading=false}
 finally{inFlight=false;render()}
}
function cleanRegistry(){
 return Array.isArray(state.registry)?state.registry.filter(r=>r&&!r.hidden).sort((a,b)=>String(b.published||"").localeCompare(String(a.published||""))):null;
}
function cleanShipments(){
 return Array.isArray(state.shipments)?state.shipments.filter(s=>s&&!s.archived&&!["completed","annulled","failed"].includes(String(s.cargo_status||"").toLowerCase())):null;
}
function carrierStats(){
 if(!Array.isArray(state.sl))return null;
 const nums=state.sl.map(p=>Number(p.score)).filter(n=>Number.isFinite(n)&&n>=0&&n<=100);
 if(!nums.length)return {total:state.sl.length,average:null,high:0,mid:0,low:0};
 return {total:nums.length,average:Math.round(nums.reduce((a,b)=>a+b,0)/nums.length),high:nums.filter(n=>n>=76).length,mid:nums.filter(n=>n>=51&&n<=75).length,low:nums.filter(n=>n<=50).length};
}
function typeOf(row){
 const raw=[row.transport,row.transport_type,row.mode,row.vehicle_type,row.transport_mode].map(v=>String(v||"")).join(" ").toLowerCase();
 if(/multimodal|мульт|смешан/.test(raw))return "multi";
 if(/rail|train|ж\/д|железн|поезд/.test(raw))return "rail";
 if(/sea|ship|marine|мор|судно|кораб/.test(raw))return "sea";
 if(/air|plane|авиа|самол/.test(raw))return "air";
 if(/truck|road|авто|машин|фур/.test(raw))return "road";
 return "other";
}
function transportStats(){
 const ships=cleanShipments();if(!ships)return null;
 const vals={road:0,rail:0,sea:0,air:0,multi:0,other:0};
 for(const row of ships)vals[typeOf(row)]++;
 return vals;
}
function transportMarkup(){
 const stats=transportStats();
 const modes=[["road","Авто","#169dfd"],["rail","Ж/Д","#8069fe"],["sea","Море","#14cbba"],["air","Авиа","#ffbd57"],["multi","Мультимодал","#dc91ff"],["other","Не указан","#8496b4"]];
 const total=stats?Object.values(stats).reduce((a,b)=>a+b,0):0;
 let pos=0;
 const segments=modes.map(([key,,color])=>{if(!total||!stats[key])return "";const from=pos;pos+=stats[key]/total*100;return color+" "+from.toFixed(2)+"% "+pos.toFixed(2)+"%"}).filter(Boolean);
 const donut=segments.length?"background:conic-gradient("+segments.join(",")+")":"";
 return '<section class="lw-cc-panel lw-cc-transport"><h2>Перевозки по видам транспорта</h2><p class="lw-cc-sub">Текущие перевозки, по данным реестра исполнения</p><div class="lw-cc-transport-inside"><div class="lw-cc-donut" style="'+donut+'"><div><strong>'+fmt(stats?total:null)+'</strong><small>в работе</small></div></div><div class="lw-cc-legend">'+modes.filter(([key])=>stats&&stats[key]>0).map(([key,title,color])=>'<div><i style="background:'+color+'"></i><span>'+title+'</span><strong>'+fmt(stats[key])+'</strong></div>').join("")+(stats&&total===0?'<p class="lw-cc-empty">Активных перевозок нет</p>':!stats?'<p class="lw-cc-empty">Нет доступа к данным</p>':"")+'</div></div>'+link("approved-shipments","Все перевозки ↗","lw-cc-fine-link")+'</section>';
}
function routeMarkup(){
 const ships=cleanShipments(),routesList=(ships||[]).filter(x=>x.origin||x.destination).slice(0,3);
 return '<section class="lw-cc-panel lw-cc-route"><div class="lw-cc-heading"><h2>Маршруты в работе</h2>'+link("approved-shipments","Открыть ↗","lw-cc-fine-link")+'</div><div class="lw-cc-map-deco" aria-hidden="true"><div class="lw-cc-map-line"></div><span class="lw-cc-map-pin lw-cc-pin-a"></span><span class="lw-cc-map-pin lw-cc-pin-b"></span></div><div class="lw-cc-route-list">'+(routesList.length?routesList.map(item=>'<div class="lw-cc-route-row"><span>↗</span><div><strong>'+escapeHTML(short(item.origin)||"Отправление не указано")+' → '+escapeHTML(short(item.destination)||"Назначение не указано")+'</strong><small>'+escapeHTML(short(item.order_code)||"Перевозка")+'</small></div></div>').join(""):ships?'<p class="lw-cc-empty">По текущим перевозкам маршруты пока не указаны</p>':'<p class="lw-cc-empty">Данные маршрутов недоступны</p>')+'</div></section>';
}
function slMarkup(){
 const d=carrierStats(),average=d?.average;
 const percent=average===null||average===undefined?null:Math.min(100,Math.max(0,average));
 return '<section class="lw-cc-panel lw-cc-service"><div class="lw-cc-heading"><h2>Service Level (SL)</h2>'+link("carrier-service","Подробнее ↗","lw-cc-fine-link")+'</div><div class="lw-cc-sl-inner"><div class="lw-cc-sl-donut" style="'+(percent!==null?"--lw-progress:"+percent+"%;":"")+'"><div><strong>'+ (percent===null?"—":percent+"%")+'</strong><small>Средний SL</small></div></div><div class="lw-cc-sl-stat">'+[[76,100,"high","76–100%"],[51,75,"mid","51–75%"],[0,50,"low","0–50%"]].map(([,,key,label])=>'<div><i class="'+key+'"></i><span>'+label+'</span><b>'+fmt(d?d[key]:null)+'</b></div>').join("")+link("carrier-service","Журнал и оценки SL","lw-cc-sl-link")+'</div></div><p class="lw-cc-sl-caption">0–50% — блокировка · 51–75% — без тендеров · 76–100% — полный доступ</p></section>';
}
function kpis(){
 const w=state.workload,req=cleanRegistry(),ships=cleanShipments();
 const cells=[
  ["▤","Заявки в реестре",req?.length,"request-registry","blue"],
  ["◷","Ожидают решения",w?.total,"overview","indigo"],
  ["◇","Тендеры",req?.filter(r=>r.kind==="tender").length,"tender-hub","violet"],
  ["▣","Перевозки в пути",ships?.length,"approved-shipments","teal"],
  ["⚑","Инциденты",w?.counts?.incidents,"incident-journal","rose"]
 ];
 return '<div class="lw-cc-kpis">'+cells.map(([ico,name,value,href,tone])=>link(href,icon(ico)+'<span class="lw-cc-kpi-info"><small>'+name+'</small><strong>'+fmt(value)+'</strong></span><span class="lw-cc-kpi-arrow" aria-hidden="true">↗</span>','lw-cc-kpi '+tone)).join("")+'</div>';
}
function urgentMarkup(){
 const w=state.workload;const arr=Array.isArray(w?.items)?w.items.slice(0,5):null;
 return '<section class="lw-cc-panel lw-cc-urgent"><div class="lw-cc-heading"><h2>Требует решения</h2><span class="lw-cc-pill">'+fmt(w?.total)+'</span></div><div class="lw-cc-urgent-list">'+(arr?arr.length?arr.map((item,i)=>link(item.section||"overview",'<span class="lw-cc-urgent-ico">'+["◷","▤","!","✉","⚑"][i]+'</span><div><strong>'+escapeHTML(short(item.label)||"Требуется действие")+'</strong><small>'+escapeHTML(short(item.order_code)||"Открыть соответствующий раздел")+' · '+localDate(item.created)+'</small></div><span>›</span>','lw-cc-urgent-link')).join(""):'<p class="lw-cc-empty">Сейчас нет действий в очереди</p>':'<p class="lw-cc-empty">Очередь пока недоступна</p>')+'</div></section>';
}
function developmentMarkup(){
 const items=Array.isArray(state.development)?state.development.filter(x=>x.status==='in_progress'||x.status==='release'):null;
 const n=items?.length;
 const title='Сейчас разрабатывается';
 const cards=items?items.slice(0,4).map(item=>{
  const text=short(String(item.description||'').split('Источник реестра:')[0])||short(item.code)||'Без описания';
  const label=item.status==='release'?'Готовится к выпуску':'В работе';
  return link('portal-feedback','<strong>'+escapeHTML(text)+'</strong><span>'+escapeHTML(label)+'</span>','lw-cc-development-item');
 }).join(''):'<p class="lw-cc-empty">Очередь разработок недоступна. Данные не подставляются вручную.</p>';
 return '<section class="lw-cc-panel lw-cc-development"><div class="lw-cc-heading"><h2>'+title+'</h2><span class="lw-cc-pill">'+(n??'—')+'</span></div><p class="lw-cc-sub">Только реальные задания из Центра доработок, без повторного ручного учёта.</p><div class="lw-cc-development-list">'+(cards||'<p class="lw-cc-empty">Активных разработок сейчас нет</p>')+'</div>'+link('portal-feedback','Открыть все доработки ↗','lw-cc-fine-link')+'</section>';
}
const tabs=[["requests","Мои заявки"],["shipments","В пути"],["tenders","Тендеры"],["closed","Завершённые"]];
function rows(){
 if(state.tab==="shipments"){
  if(!Array.isArray(state.shipments))return '<tr><td colspan="6" class="lw-cc-no-data">Нет доступа к данным перевозок</td></tr>';
  const items=cleanShipments().slice(0,6);
  if(!items.length)return '<tr><td colspan="6" class="lw-cc-no-data">Нет активных перевозок</td></tr>';
  return items.map(r=>'<tr><td>'+escapeHTML(short(r.order_code)||"—")+'</td><td>'+escapeHTML(short(r.carrier_name)||"—")+'</td><td>'+escapeHTML(short(r.origin)||"—")+' → '+escapeHTML(short(r.destination)||"—")+'</td><td>'+escapeHTML(short(r.transport)||"—")+'</td><td><span class="lw-cc-status">'+escapeHTML(statusText(r.cargo_status))+'</span></td><td>'+link("approved-shipments","Открыть ↗")+'</td></tr>').join("");
 }
 const all=cleanRegistry();
 if(!all)return '<tr><td colspan="6" class="lw-cc-no-data">Реестр заявок недоступен</td></tr>';
 const filtered=all.filter(r=>state.tab==="tenders"?r.kind==="tender":state.tab==="closed"?/completed|closed|archived|annulled/i.test(String(r.state)):r.kind!=="tender");
 if(!filtered.length)return '<tr><td colspan="6" class="lw-cc-no-data">По этому фильтру записей нет</td></tr>';
 return filtered.slice(0,6).map(r=>'<tr><td><strong>'+escapeHTML(short(r.protocol||r.id?.slice?.(0,8))||"—")+'</strong></td><td>'+escapeHTML(short(r.bitrix_task)||"—")+'</td><td>'+escapeHTML(short(r.order_code)||"—")+'</td><td title="'+escapeHTML(short(r.summary))+'">'+escapeHTML(short(r.summary)||"—")+'</td><td><span class="lw-cc-status">'+escapeHTML(statusText(r.state))+'</span></td><td>'+link(r.kind==="tender"?"tender-hub":"request-registry","Открыть ↗")+'</td></tr>').join("");
}
function tableMarkup(){
 const isShipping=state.tab==="shipments";
 return '<section class="lw-cc-panel lw-cc-register"><div class="lw-cc-tablebar"><div class="lw-cc-tablist" role="tablist" aria-label="Фильтр заявок и перевозок">'+tabs.map(([key,label])=>'<button type="button" class="lw-cc-tab" role="tab" aria-selected="'+(state.tab===key)+'" data-lw-cc-tab="'+key+'">'+label+'</button>').join("")+'</div>'+link("create-request","＋ Новая заявка","lw-cc-create")+'</div><div class="lw-cc-table-scroll"><table><thead><tr>'+(isShipping?["Заказ","Перевозчик","Маршрут","Транспорт","Статус","Действия"]:["Заявка / протокол","№ Битрикс","Заказ","Описание","Статус","Действия"]).map(x=>"<th>"+x+"</th>").join("")+'</tr></thead><tbody>'+rows()+'</tbody></table></div><div class="lw-cc-table-foot">'+link(isShipping?"approved-shipments":"request-registry","Открыть полный реестр ↗","lw-cc-fine-link")+'<span>Записи из действующей тестовой базы</span></div></section>';
}
function actionsMarkup(){
 const x=[
  ["create-request","✚","Создать заявку","Новое предложение перевозки","featured"],
  ["tender-hub","◇","Запустить тендер","Сравнение ставок",""],
  ["management-reports","▤","Сформировать отчёт","Отчёты и аналитика",""],
  ["request-registry","⇩","Экспортировать реестр","Excel в разделе заявок",""],
  ["team","♙","Добавить пользователя","Доступ и роли",""],
  ["help","?","FAQ и инструкции","Работа с порталом",""]
 ];
 return '<div class="lw-cc-actions">'+x.map(([href,ico,title,subtitle,mod])=>link(href,icon(ico)+'<span><strong>'+title+'</strong><small>'+subtitle+'</small></span>','lw-cc-action '+mod)).join("")+'</div>';
}
function render(){
 const host=document.getElementById(ROOT_ID);if(!host)return;
 const stamp=state.updated?state.updated.toLocaleString("ru-RU",{timeZone:"Europe/Minsk",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"ожидаем";
 host.innerHTML=
 '<header class="lw-cc-hero"><div class="lw-cc-hero-image" aria-hidden="true"><span class="lw-cc-ship">▰▰▰</span><span class="lw-cc-train">▰▰</span><span class="lw-cc-plane">✈</span></div><div class="lw-cc-hero-content"><span class="lw-cc-brow">ЛОГИСТИКА · ЦЕНТР УПРАВЛЕНИЯ</span><h1>Кабинет владельца</h1><p>Заявки, ставки, исполнение и качество перевозчиков — в одном месте.</p><div class="lw-cc-hero-links">'+link("request-registry","Реестр заявок ↗","")+'<span>Обновлено: '+stamp+' · Минск</span></div></div></header>'+
 (state.errors.length?'<p class="lw-cc-warning" role="status">Часть данных недоступна: '+escapeHTML(state.errors.join("; "))+'</p>':"")+
 kpis()+'<div class="lw-cc-triad">'+transportMarkup()+routeMarkup()+slMarkup()+'</div><div class="lw-cc-work">'+tableMarkup()+urgentMarkup()+'</div>'+developmentMarkup()+actionsMarkup();
 const button=host.querySelector('[data-lw-cc-tab="'+state.tab+'"]');
 if(button)button.setAttribute("aria-current","true");
}
/* Owner role selector lives in header; the real role preview controls stay mounted. */
function syncRolePanel(cab,active){
 document.body.classList.toggle("lw-cc-owner-view",active);
 if(!active){document.body.classList.remove("lw-cc-role-open");return;}
 const preview=document.querySelector(".test-cabinets");
 const topbar=cab.querySelector(".cabinet-topbar");
 if(!topbar||!preview)return;
 let trigger=topbar.querySelector(".lw-cc-role-trigger");
 if(!trigger){
   trigger=document.createElement("button");
   trigger.type="button";
   trigger.className="lw-cc-role-trigger";
   trigger.setAttribute("aria-controls","lw-cc-role-panel");
   trigger.setAttribute("aria-haspopup","true");
   trigger.textContent="⚙ Просмотр кабинетов ▾";
   trigger.title="Открыть переключатель кабинетов в тестовой среде";
   trigger.addEventListener("click",event=>{
     event.stopPropagation();
     const opened=document.body.classList.toggle("lw-cc-role-open");
     trigger.setAttribute("aria-expanded",String(opened));
   });
   const right=topbar.querySelector(":scope > .bar:last-child")||topbar;
   right.prepend(trigger);
 }
 preview.id="lw-cc-role-panel";
 trigger.setAttribute("aria-expanded",String(document.body.classList.contains("lw-cc-role-open")));
 if(!topbar.querySelector(".lw-cc-environment")){
   const tag=document.createElement("span");
   tag.className="lw-cc-environment";
   tag.textContent="● Тестовая среда";
   tag.title="Все действия выполняются в тестовой среде";
   trigger.insertAdjacentElement("beforebegin",tag);
 }
}
document.addEventListener("click",event=>{
 if(!document.body.classList.contains("lw-cc-role-open"))return;
 if(event.target.closest?.(".test-cabinets,.lw-cc-role-trigger"))return;
 document.body.classList.remove("lw-cc-role-open");
 document.querySelector(".lw-cc-role-trigger")?.setAttribute("aria-expanded","false");
});
document.addEventListener("keydown",event=>{
 if(event.key!=="Escape")return;
 document.body.classList.remove("lw-cc-role-open");
 document.querySelector(".lw-cc-role-trigger")?.setAttribute("aria-expanded","false");
});
function mount(){
 const cab=owner();
 if(!cab){
   document.body.classList.remove("lw-cc-owner-view","lw-cc-role-open");
   return;
 }
 // Command-center shell is the Owner's *whole* cabinet, not only the Overview tab.
 // Keep the approved dark sidebar, topbar and compact role picker across sections.
 cab.classList.add("lw-cc-active");
 syncRolePanel(cab,true);
 const panel=overview();
 if(!panel)return; // Other sections still retain the Owner shell and role controls.
 const isShown=!panel.hidden;
 if(!document.getElementById(ROOT_ID)){
  const element=document.createElement("div");element.id=ROOT_ID;element.setAttribute("aria-label","Операционная сводка владельца");
  panel.prepend(element);
 }
 if(!panel.dataset.lwCcReady)panel.dataset.lwCcReady="true";
 if(!hasLoaded&&!inFlight&&isShown)load();else if(!document.getElementById(ROOT_ID)?.innerHTML)render();
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount()})}
document.addEventListener("click",event=>{
 const tab=event.target.closest?.("[data-lw-cc-tab]");
 if(!tab||!document.getElementById(ROOT_ID)?.contains(tab))return;
 const key=tab.getAttribute("data-lw-cc-tab");
 if(!tabs.some(x=>x[0]===key))return;
 state.tab=key;render();
});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&visible())load()});
for(const name of ["hashchange","focus","requests-updated","workload-updated"]){
 window.addEventListener(name,()=>{schedule();if(visible()&&hasLoaded)load()});
}
new MutationObserver(schedule).observe(document.getElementById("root")||document.body,{childList:true,subtree:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule);else schedule();
setInterval(()=>{if(!document.hidden&&visible())load()},90000);
window.lwOwnerCommandVersion="owner-command-04";
})();