/* Issue #47: carrier acceptance lives in "Мои заявки" (staging only). */
(function(){
"use strict";
const ROOT_ID="carrier-awarded-workflow";
const route="#carrier-orders";
let items=[],role="",busy=false,loaded=false,loading=false,notice="",lastShown=false;
const localizations={
 ru:{heading:"Заявки к исполнению",intro:"Здесь находятся перевозки, по которым Владелец выбрал вас победителем. Примите одобренную заявку в работу — после этого исполнение и трекинг доступны в разделе «Мои перевозки».",refresh:"Обновить",empty:"Пока нет выигранных перевозок.",awaiting:"Ожидает принятия",preparing:"Подготовка транспортной заявки",pending:"Документ на согласовании",returned:"Возвращена на доработку",approved:"Документ согласован",performing:"В работе",completed:"Перевозка завершена",take:"Взять в работу",document:"Транспортная заявка",execution:"Открыть исполнение",view:"Открыть заявку",error:"Не удалось загрузить заявки",saving:"Принимаем заявку…",accepted:"Заявка принята. Продолжайте в разделе «Мои перевозки».",confirm:"Принять выбранную перевозку в работу?",order:"Заказ",bitrix:"Битрикс",price:"Согласованная ставка",mode:"Транспорт",reason:"Исполнение доступно после принятия выбранной заявки в работу."},
 en:{heading:"Shipments assigned to you",intro:"Shipments awarded to you by the Owner. Accept an awarded shipment, then continue tracking and execution in My Shipments.",refresh:"Refresh",empty:"No awarded shipments yet.",awaiting:"Awaiting acceptance",preparing:"Preparing transport instruction",pending:"Document awaiting approval",returned:"Returned for revision",approved:"Document approved",performing:"In progress",completed:"Completed",take:"Accept shipment",document:"Transport instruction",execution:"Open execution",view:"Open shipment",error:"Unable to load shipments",saving:"Accepting…",accepted:"Shipment accepted. Continue in My Shipments.",confirm:"Accept this shipment?",order:"Order",bitrix:"Bitrix",price:"Agreed rate",mode:"Transport",reason:"Execution is available after the awarded shipment is accepted."},
 zh:{heading:"待执行的运输订单",intro:"货主选中您为承运人的运输订单。接受中标运输任务后，即可前往“我的运输”执行和跟踪。",refresh:"刷新",empty:"暂无中标运输订单。",awaiting:"待接受",preparing:"准备运输委托书",pending:"文件待审批",returned:"退回修改",approved:"文件已批准",performing:"运输中",completed:"已完成",take:"接受任务",document:"运输委托书",execution:"进入执行",view:"查看运输",error:"无法加载订单",saving:"正在接受…",accepted:"已接受订单。请前往“我的运输”继续操作。",confirm:"确定接受该运输订单？",order:"订单",bitrix:"Bitrix",price:"确认运费",mode:"运输方式",reason:"接受中标订单后即可开始执行。"}
};
const t=()=>localizations[document.documentElement.lang.slice(0,2)]||localizations.ru;
const e=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const node=()=>document.querySelector('.cabinet-panel[data-section="carrier-orders"] #carrier-orders')||
 document.querySelector('.cabinet-panel[data-section="carrier-orders"]')||document.querySelector('.carrier-portal #carrier-orders');
const visible=()=>location.hash===route;
function stage(item){
 // Staging: transport application authoring is deferred. Acceptance unlocks the
 // existing Task2 shipment execution API, retaining actor checks and history.
 if(item.process_status==="completed")return ["completed","view","#approved-shipments"];
 if(item.process_status==="awaiting_take")return ["awaiting","take",null];
 return ["performing","execution","#approved-shipments"];
}
function render(){
 const parent=node();if(!parent||!visible())return;
 let root=parent.querySelector("#"+ROOT_ID);
 if(!root){root=document.createElement("section");root.id=ROOT_ID;root.className="carrier-awarded-workflow";parent.prepend(root);}
 if(!loaded){root.innerHTML='<p class="carrier-flow-loading" role="status">'+e(t().refresh)+'…</p>';return;}
 if(role!=="carrier"){root.remove();return;}
 const dict=t();
 const sorted=items.slice().sort((a,b)=>Number(stage(a)[0]==="awaiting")-Number(stage(b)[0]==="awaiting")).reverse();
 root.innerHTML='<div class="carrier-flow-head"><div><h2>'+e(dict.heading)+'</h2><p>'+e(dict.intro)+'</p></div><button type="button" data-flow-refresh>'+e(dict.refresh)+'</button></div>'+
 (notice?'<p class="carrier-flow-message" role="status">'+e(notice)+'</p>':'')+
 (sorted.length?'<div class="carrier-flow-grid">'+sorted.map(item=>{
  const [key,action,href]=stage(item),no=item.registration_no||item.order_code;
  const title=key==="approved"&&item.process_status!=="completed"?dict.performing:dict[key];
  return '<article class="carrier-flow-card"><div class="carrier-flow-title"><strong>'+e(no)+'</strong><span class="carrier-flow-status">'+e(title)+'</span></div>'+
    '<p><b>'+e(dict.order)+':</b> '+e(item.order_code)+'</p>'+
    '<p><b>'+e(dict.bitrix)+':</b> '+e(item.bitrix_task||"—")+'</p>'+
    '<p><b>'+e(dict.price)+':</b> '+e(item.amount==null?"—":item.amount+" "+(item.currency||""))+'</p>'+
    '<p><b>'+e(dict.mode)+':</b> '+e(item.mode||"—")+'</p>'+
    '<div class="carrier-flow-actions"><button type="button" '+(busy?'disabled ':'')+'data-flow-action="'+e(action)+'" data-flow-order="'+e(item.order_code)+'">'+e(dict[action])+'</button></div>'+
    (key==="preparing"||key==="pending"||key==="returned"?'<small>'+e(dict.reason)+'</small>':'')+'</article>';
 }).join("")+'</div>':'<p class="carrier-flow-empty">'+e(dict.empty)+'</p>');
}
async function refresh(force=false){
 if(loading||(!visible()&&!force))return;
 loading=true;
 try{
  const res=await fetch("/api/task2",{credentials:"same-origin",cache:"no-store"});
  if(!res.ok)throw Error(res.status===403?"Доступ запрещён":"HTTP "+res.status);
  const data=await res.json();
  if(!Array.isArray(data.items))throw Error("Invalid response");
  role=data.role;items=data.items;loaded=true;notice="";
 }catch(err){loaded=true;role=role||"carrier";notice=t().error+": "+err.message;}
 finally{loading=false;render();}
}
async function take(order){
 if(busy||!items.some(i=>i.order_code===order&&i.process_status==="awaiting_take"))return;
 if(!window.confirm(t().confirm))return;
 busy=true;notice=t().saving;render();
 try{
  const res=await fetch("/api/task2",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"take",order}),credentials:"same-origin",cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok)throw Error(data.error||"HTTP "+res.status);
  await refresh(true);
  notice=t().accepted;
  render();
  location.hash="#approved-shipments";
  window.dispatchEvent(new CustomEvent("carrier-flow-open-execution",{detail:{order}}));
 }catch(err){notice=t().error+": "+err.message;render();}
 finally{busy=false;render();}
}
function openAction(order,action){
 if(action==="take"){void take(order);return;}
 if(action==="execution"||action==="view"){
  location.hash="#approved-shipments";
  window.dispatchEvent(new CustomEvent("carrier-flow-open-execution",{detail:{order}}));
  return;
 }
 if(action==="document")location.hash="#approved-shipments";
}
document.addEventListener("click",ev=>{
 const btn=ev.target.closest("#"+ROOT_ID+" [data-flow-action],#"+ROOT_ID+" [data-flow-refresh]");
 if(!btn)return;
 ev.preventDefault();
 if(btn.hasAttribute("data-flow-refresh")){void refresh(true);return;}
 const order=btn.dataset.flowOrder,action=btn.dataset.flowAction;
 if(items.some(x=>x.order_code===order)&&["take","execution","view"].includes(action))openAction(order,action);
});
window.addEventListener("hashchange",()=>{if(visible()){render();void refresh();}else{loaded=false;}});
let scheduled=false;
const observer=new MutationObserver(()=>{
 if(!visible()||scheduled)return;
 const parent=node();
 if(!parent||parent.querySelector("#"+ROOT_ID))return;
 scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});
});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",()=>{if(visible()){render();void refresh();}});
if(visible()){render();void refresh();}
})();