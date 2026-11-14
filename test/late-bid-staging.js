/* Staging Issue #47: late-rate preparation. Uses canonical portal fetch/Auth; no separate credentials. */
(function(){
"use strict";
if(!location.pathname.includes("/test/"))return;
const query=new URLSearchParams(location.search);
const page=query.get("page")||"";
const quotePage=page==="quote";
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
let latest=null,busy=false,refreshPending=false;
window.freightLateDraftActive=false;
function orderCode(){return String(query.get("order")||document.querySelector('input[aria-label="Номер заказа"]')?.value||"").trim().toUpperCase();}
function ownerOfferPanel(){
 if(location.hash.split("?")[0]!=="#offers")return null;
 return document.querySelector('.cabinet-app[data-cabinet-role="owner"] .cabinet-panel[data-section="offers"]');
}
function locate(){
 if(quotePage){const host=document.querySelector("main .form-shell");if(!host)return null;
 let node=host.querySelector("#late-bid-controls");if(!node){node=document.createElement("section");node.id="late-bid-controls";node.className="section";const heading=host.querySelector(".form-heading");(heading||host).insertAdjacentElement(heading?"afterend":"afterbegin",node);}return node;}
 // The Owner's late-draft lock belongs ONLY to the offer review section.
 // Do not mount it in <main>: that node is shared by every cabinet tab.
 const host=ownerOfferPanel();
 document.querySelectorAll("#late-bid-controls-owner").forEach(n=>{if(!host||!host.contains(n))n.remove();});
 if(!host)return null;
 let node=host.querySelector("#late-bid-controls-owner");
 if(!node){node=document.createElement("section");node.id="late-bid-controls-owner";node.className="section";host.prepend(node);}
 return node;
}
function status(text,error=false){const root=locate();if(!root)return;let el=root.querySelector("[data-late-status]");if(!el){el=document.createElement("p");el.dataset.lateStatus="";el.setAttribute("role","status");root.append(el);}el.textContent=text;el.style.color=error?"#bd3535":"";}
async function api(path,body){
 const res=await fetch("/api/late-bid-drafts"+path,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});
 const data=await res.json().catch(()=>({error:"Нет ответа API"}));
 if(!res.ok)throw Error(data.error||"Ошибка API");return data;
}
function quoteView(data){
 const root=locate();if(!root)return;
 const order=orderCode();const assigned=(data.assigned||[]).find(i=>i.order_code===order),active=(data.items||[]).find(i=>i.order_code===order&&i.status==="active");
 const old=window.freightLateDraftActive;
 window.freightLateDraftActive=!!active&&data.role==="carrier"&&!!assigned&&!assigned.has_winner;
 window.freightLateDraftOrder=order;
 if(old!==window.freightLateDraftActive)window.dispatchEvent(new Event("freight-late-bid-state"));
 if(!assigned||String(assigned.workflow_status||"").toLowerCase()==="annulled"){root.hidden=true;return;}
 const overdue=new Date(assigned.deadline+"+03:00").getTime()<=Date.now();
 if(!overdue||data.role!=="carrier"){root.hidden=true;return;}
 root.hidden=false;
 const blocked=assigned.has_winner?"По заявке уже выбран победитель. Новые ставки запрещены.":
   assigned.declined?"Отказ от участия зафиксирован. Новая ставка недоступна.":
   assigned.has_bid?"Ваше предложение по заявке уже отправлено.":
   active?"Подготовка поздней ставки активна. Владелец видит её и не может выбрать победителя. Завершите ставку кнопкой в форме или отмените подготовку.":
   "Срок обычного ответа истёк. Вы можете самостоятельно начать позднюю ставку до выбора победителя. Её учёт решает Владелец; штраф за пропуск срока сохраняется.";
 const action=!assigned.has_winner&&!assigned.declined&&!assigned.has_bid;
 root.innerHTML='<h3>Поздняя ставка · '+esc(order)+'</h3><p>'+esc(blocked)+'</p>'+
   (action?'<button class="btn secondary" type="button" data-late-action="'+(active?"cancel":"start")+'" data-notification="'+esc(assigned.notification_id)+'" '+(busy?"disabled":"")+'>'+(active?"Отменить подготовку":"Начать подготовку поздней ставки")+'</button>':"")+'<p data-late-status role="status"></p>';
}
function carrierInboxView(data){
 const root=locate();if(!root)return;
 if(data.role!=="carrier"){root.hidden=true;return;}
 const late=(data.assigned||[]).filter(i=>{
  const deadline=Date.parse(String(i.deadline||"").replace(/(?:Z|[+-]\\d\\d:\\d\\d)$/,"")+"+03:00");
  return Number.isFinite(deadline)&&deadline<=Date.now()&&!i.has_winner&&!i.declined&&!i.has_bid&&String(i.workflow_status||"").toLowerCase()!=="annulled";
 });
 if(!late.length){root.hidden=true;return;}
 root.hidden=false;root.style.cssText="margin:16px 0;padding:16px;border:1px solid #76c6dd;border-radius:12px;background:#102d42;color:#eafaff";
 root.innerHTML='<h3 style="margin:0 0 8px">Просроченные ставки — подача открыта</h3><p>Пока победитель не выбран, вы можете подготовить и отправить ставку после дедлайна. Решение о её рассмотрении принимает Владелец.</p>'+late.map(i=>'<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0"><strong>Заявка '+esc(i.order_code)+'</strong><a class="btn secondary" style="display:inline-block" href="?page=quote&amp;order='+encodeURIComponent(i.order_code)+'">Подготовить позднюю ставку</a></div>').join('');
}
function ownerView(data){
 const root=locate();if(!root)return;
 const active=(data.items||[]).filter(i=>i.status==="active"&&!i.winner_count);
 if(data.role!=="owner"){root.hidden=true;return;}
 root.hidden=false;
 root.innerHTML='<h3>Подготовка поздних ставок · блокировка выбора победителя</h3>'+
  (active.length?'<p>Пока указанные перевозчики готовят позднюю ставку, выбор победителя по соответствующей заявке запрещён на сервере.</p>'+
    active.map(i=>'<div class="notice warning"><strong>'+esc(i.order_code)+'</strong> · '+esc(i.carrier_login)+
    ' · начал: '+esc(new Date(i.started_at).toLocaleString("ru-RU",{timeZone:"Europe/Minsk"}))+
    ' (Минск) <button class="btn secondary" type="button" data-late-action="resolve" data-order="'+esc(i.order_code)+'" data-notification="'+esc(i.notification_id)+'">Снять зависшую подготовку</button></div>').join(""):
    '<p>Активных поздних ставок нет. Блокировки выбора победителя по этому основанию отсутствуют.</p>')+
   '<p data-late-status role="status"></p>';
 lockWinnerButtons(active);
}
function lockWinnerButtons(active){
 const scope=ownerOfferPanel();
 if(!scope)return;
 const orders=new Set(active.map(i=>i.order_code));
 scope.querySelectorAll(".offer-selection-control button").forEach(btn=>{
   if(!btn.textContent.includes("Выбрать этот вариант"))return;
   const row=btn.closest("tr,article,.offer-row");
   const isBlocked=!!row&&[...orders].some(o=>row.textContent.includes(o));
   if(isBlocked){btn.disabled=true;btn.title="Пока готовится поздняя ставка, выбор победителя заблокирован";}
 });
}
async function refresh(){
 // Late-bid checks belong only to Owner and Carrier. Never call the API
 // or show diagnostic status in VED, Supplier, Designer or other cabinets.
 const cabinet=document.querySelector('.cabinet-app[data-cabinet-role]');
 const role=cabinet?.getAttribute('data-cabinet-role');
 if(!quotePage && role==='owner' && !ownerOfferPanel()){
   document.querySelector("#late-bid-controls-owner")?.remove();
   return;
 }
 if(!quotePage && role!=='owner' && role!=='carrier'){
   document.querySelector('#late-bid-controls-owner')?.remove();
   return;
 }
 if(refreshPending)return;refreshPending=true;
 try{
  const data=await api(quotePage?"?order="+encodeURIComponent(orderCode()):"");
  latest=data;
  if(quotePage)quoteView(data);
  else if(data.role==="owner")ownerView(data);
  else if(data.role==="carrier")carrierInboxView(data);
 }catch(e){if(quotePage)window.freightLateDraftActive=false;const root=locate();if(root){root.hidden=false;status("Проверка поздних ставок: "+e.message,true);}}
 finally{refreshPending=false;}
}
document.addEventListener("click",async ev=>{
 const hit=ev.target.closest("#late-bid-controls [data-late-action],#late-bid-controls-owner [data-late-action]");
 if(!hit||busy)return;
 ev.preventDefault();
 const action=hit.dataset.lateAction,order=hit.dataset.order||orderCode(),notificationId=hit.dataset.notification;
 let reason="";
 if(action==="resolve"){reason=window.prompt("Причина ручного снятия зависшей подготовки (минимум 10 символов):","")||"";if(reason.length<10)return;}
 if(action==="cancel"&&!window.confirm("Отменить подготовку поздней ставки?"))return;
 busy=true;hit.disabled=true;
 try{await api("",{action,order,notificationId,reason});await refresh();}
 catch(e){status(e.message,true);}
 finally{busy=false;}
});
document.addEventListener("click",ev=>{
 if(quotePage||!latest||latest.role!=="owner"||!ownerOfferPanel())return;
 const btn=ev.target.closest(".offer-selection-control button");
 if(!btn||!btn.textContent.includes("Выбрать этот вариант"))return;
 const row=btn.closest("tr,article,.offer-row");
 const active=(latest.items||[]).filter(i=>i.status==="active"&&!i.winner_count);
 if(row&&active.some(i=>row.textContent.includes(i.order_code))){
   ev.preventDefault();ev.stopImmediatePropagation();
   status("Выбор победителя временно заблокирован: перевозчик готовит позднюю ставку.",true);
 }
},true);
if(quotePage){document.addEventListener("change",ev=>{if(ev.target.matches('input[name="order"]'))refresh();});}
const observer=new MutationObserver(()=>{
 if(!latest)return;
 if(quotePage){const root=document.querySelector("#late-bid-controls");if(!root)quoteView(latest);return;}
 if(latest.role==="owner"){
   const scope=ownerOfferPanel();
   if(!scope){document.querySelector("#late-bid-controls-owner")?.remove();return;}
   if(!scope.querySelector("#late-bid-controls-owner"))ownerView(latest);
   else lockWinnerButtons((latest.items||[]).filter(i=>i.status==="active"&&!i.winner_count));
 }
});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",refresh);
window.addEventListener("hashchange",refresh);
setInterval(()=>{if(!document.hidden)refresh();},20000);
refresh();
})();