
(() => {
"use strict";
const API="/api/task2",el=(q,r=document)=>r.querySelector(q),els=(q,r=document)=>Array.from(r.querySelectorAll(q));
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText=v=>{if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Minsk",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(d)};
const dateInput=v=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Minsk",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(d).replace(" ","T")};
const iso=v=>v&&!/[Z+-]\d\d:\d\d$/.test(v)?/^\d{4}-\d{2}-\d{2}$/.test(v)?v+"T00:00+03:00":v+":00+03:00":v;
const descriptions={
  new_plan_date:"Добавьте новую плановую дату. Исходная дата остаётся неизменяемой; переносы возможны только до фактического выхода.",
  new_plan_reason:"Каждый перенос требует причины и записывается в журнал.",
  actual_departure:"Фактический выход груза. После сохранения добавлять плановые даты нельзя.",
  location:"Укажите город, станцию, порт или конкретный пункт нахождения груза. Каждая точка сохраняется отдельно.",
  location_date:"Дата и время сведений о местонахождении по Минску.",
  location_comment:"Необязательное уточнение к контрольной точке.",
  pto_yes:"Отметьте «Да» только после фактического прибытия на ПТО. ВЭД получит задачу на проверку.",
  pto_date:"Фактическое время прибытия на ПТО, по Минску.",
  customs_date:"Дата растаможки; после сохранения создаётся задача ВЭД «Приёмка на складе».",
  container_no:"Необязательное поле во время перевозки. При завершении ВЭД/Владелец решает, нужен ли запрос перевозчику.",
  description:"Укажите, какие документы нужны, и причину запроса. Каждый запрос создаёт отдельную задачу ВЭД.",
  message:"Сообщение видно ВЭД, Владельцу и назначенному перевозчику.",
  claim_description:"Обстоятельства, время, место, нарушение. Необходимы для отправки акта.",
  claim_amount:"Сумма и валюта требования, если применимо.",
  claim_evidence:"Укажите подтверждающие документы и приложите их в разделе документов.",
  claim_reason:"Причина отказа либо решение ВЭД/Владельца.",
  transport_waybill:"CMR, СМГС, AWB либо коносамент B/L в зависимости от вида транспорта.",
  transport_consignee:"Реквизиты грузополучателя.",
  transport_vehicle:"Автомобиль, поезд/вагон, авиарейс либо судно.",
  transport_notes:"Дополнительные указания перевозчику."
};
const docs=[["invoice","Инвойс"],["packing_list","Упаковочный лист"],["contract","Контракт"],["cmr","CMR"],["smgs","СМГС"],["awb","AWB"],["bill_of_lading","Коносамент"],["customs","Таможенные документы"],["certificates","Сертификаты"],["other","Другое"]];
const states={awaiting_take:"Ожидает принятия",in_progress:"В работе",waiting_container:"Ожидает контейнер",claim:"Претензия",completed:"Выполнено"};
const taskNames={missing_documents:"Недостающие документы",transport_documents:"Документы на перевозку",pto_review:"Проверка документов на ПТО",warehouse_acceptance:"Приёмка на складе",container_number:"Указать № контейнера"};
let state={items:[],data:null,order:"",tab:"execution",role:"",error:"",message:"",busy:false,csv:null},root;
const B=(id,text,cls="")=>`<button type="button" class="t2-btn ${cls}" data-action="${E(id)}">${E(text)}</button>`;
const F=(id,label,type="text",value="",disabled=false)=>`<label class="t2-field"><b>${E(label)} <span class="t2-help" title="${E(descriptions[id]||"Введите достоверные данные")}">?</span></b>${type==="textarea"?`<textarea name="${E(id)}" ${disabled?"disabled":""}>${E(value)}</textarea>`:`<input name="${E(id)}" type="${type}" value="${E(value)}" ${disabled?"disabled":""}>`}<small>${E(descriptions[id]||"")}</small></label>`;
const V=id=>el(`[name="${id}"]`,root)?.value?.trim()||"";
const group=(heading,inner)=>`<section class="t2-card"><h3>${E(heading)}</h3>${inner}</section>`;
const label=v=>`<small class="t2-meta">${E(v)}</small>`;
const row=(name,value)=>`<dt>${E(name)}</dt><dd>${E(value??"—")}</dd>`;
const flash=()=>`${state.error?`<p class="t2-error">${E(state.error)}</p>`:""}${state.message?`<p class="t2-success">${E(state.message)}</p>`:""}`;
async function api(path="",opt){const r=await fetch(API+path,opt);const t=await r.text();let j;try{j=JSON.parse(t)}catch{throw Error("Сервер не ответил корректным JSON, HTTP "+r.status)}if(!r.ok)throw Error(j.error||"Ошибка HTTP "+r.status);return j}
async function loadList(){
  try{const d=await api();state.items=d.items||[];state.role=d.role||"";if(!state.items.some(i=>i.order_code===state.order))state.order=state.items[0]?.order_code||"";if(state.order)state.data=await api("?order="+encodeURIComponent(state.order));else state.data=null;state.error="";render()}catch(e){state.error=e.message;render()}
}
async function reload(){if(!state.order)return;state.data=await api("?order="+encodeURIComponent(state.order));render()}
async function perform(action,payload={},file=null){
 if(state.busy)return;state.busy=true;state.error="";try{
  let body,headers;
  if(file){body=new FormData();body.set("action",action);body.set("order",state.order);body.set("file",file);Object.entries(payload).forEach(([k,v])=>body.set(k,v))}
  else {body=JSON.stringify({action,order:state.order,...payload});headers={"Content-Type":"application/json"}}
  const result=await api("",{method:"POST",body,headers});
  state.message=result.finished?"Перевозка завершена":result.needsContainerDecision?"Номер контейнера не указан: выберите «Да» или «Нет» ниже":"Сохранено";
  await reload();return result;
 }catch(e){state.error=e.message;render();return null}finally{state.busy=false}
}
function init(){
  if(root)return;
  const style=document.createElement("style");style.textContent=`
  .t2-open{position:fixed;right:12px;bottom:16px;z-index:100000;background:#194a71;color:#fff;border:1px solid #5c9ec7;border-radius:12px;padding:9px 13px;box-shadow:0 3px 20px #0004;font-weight:650;cursor:pointer}
  #t2-dialog{display:none;position:fixed;inset:0;z-index:100010;background:#101e32b9;padding:12px;font:14px/1.45 system-ui,-apple-system,Arial;color:#21364b}
  #t2-dialog.open{display:block}#t2-dialog *{box-sizing:border-box}#t2-dialog button{cursor:pointer}
  .t2-window{height:100%;max-width:1260px;margin:auto;background:#f7f9fc;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px #0007}
  .t2-header{background:#142f4e;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:12px 16px}
  .t2-header strong{font-size:18px}.t2-body{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:0;flex:1}
  .t2-sidebar{background:#ebf0f7;border-right:1px solid #d3deeb;overflow:auto;padding:10px}.t2-sidebar button{display:block;width:100%;text-align:left;margin-bottom:8px;background:white;border:1px solid #d6dfe9;border-radius:8px;padding:9px;color:#264258}
  .t2-sidebar button.selected{background:#cee3f6;border-color:#5998c6}.t2-content{overflow:auto;padding:14px 18px 45px;min-width:0}
  .t2-tabs{display:flex;flex-wrap:wrap;gap:5px;padding:12px 0;border-bottom:1px solid #d9e3ee;margin-bottom:12px}.t2-tabs button{border:1px solid #c9d7e4;background:#fff;padding:8px 12px;border-radius:9px;color:#1e4768}.t2-tabs button.selected{background:#174c75;color:#fff}
  .t2-card{background:white;border:1px solid #dfe7ee;border-radius:12px;padding:14px;margin:12px 0}.t2-card h3{font-size:16px;margin:0 0 9px}.t2-card p{margin:8px 0}
  .t2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.t2-field{display:flex;flex-direction:column;gap:4px;min-width:0}.t2-field b{font-size:13px}
  .t2-field input,.t2-field textarea,#t2-dialog select,#t2-dialog input[type=file],#t2-dialog input[type=datetime-local]{min-width:0;width:100%;padding:8px;border:1px solid #bdcddd;border-radius:7px;font:14px system-ui;color:#182d43;background:#fff}
  .t2-field input:disabled{background:#edf1f5;color:#667}.t2-field small,.t2-meta{font:11px/1.4 system-ui;color:#61778d}.t2-help{display:inline-flex;background:#dfebf7;color:#235177;border-radius:50%;align-items:center;justify-content:center;width:17px;height:17px;font-size:11px;cursor:help}
  .t2-btn{border:1px solid #adc5d9;color:#204b73;background:#f3f7fc;border-radius:8px;padding:8px 12px;font-weight:600}.t2-btn.primary{background:#125684;color:white}.t2-btn.danger{color:#992222;border-color:#dc9e9e}
  .t2-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.t2-list{border-bottom:1px solid #e1e9f0;padding:8px 0}.t2-list:last-child{border:0}.t2-kv{display:grid;grid-template-columns:150px 1fr;gap:6px 10px}.t2-kv dt{color:#667c90}.t2-kv dd{margin:0;font-weight:600;overflow-wrap:anywhere}
  .t2-error{padding:10px;background:#fff0ee;color:#922;border:1px solid #e9bdb7;border-radius:8px}.t2-success{padding:10px;background:#f0faf2;color:#276132;border:1px solid #add9b2;border-radius:8px}
  .t2-table{border-collapse:collapse;width:100%;font-size:12px}.t2-table td,.t2-table th{padding:8px;border-bottom:1px solid #e0e7ee;text-align:left;overflow-wrap:anywhere}
  @media(max-width:700px){#t2-dialog{padding:0}.t2-window{border-radius:0}.t2-body{display:flex;flex-direction:column}.t2-sidebar{height:110px;display:flex;gap:8px}.t2-sidebar button{min-width:150px;max-width:200px;margin:0}.t2-content{padding:9px}.t2-grid{grid-template-columns:1fr}.t2-kv{grid-template-columns:110px 1fr}.t2-open{bottom:8px;right:8px}}
  `;document.head.append(style);
  root=document.createElement("section");root.id="t2-dialog";root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");
  root.innerHTML=`<div class="t2-window"><header class="t2-header"><div><strong>Задача №2 · Единый процесс перевозки</strong><div style="font-size:11px;opacity:.8">ТЕСТОВАЯ СРЕДА · Владелец, перевозчик, ВЭД</div></div><button class="t2-btn" data-action="close">Закрыть ✕</button></header><div class="t2-body"><aside class="t2-sidebar"></aside><div class="t2-content"></div></div></div>`;
  document.body.append(root);
  const floating=document.createElement("button");floating.className="t2-open";floating.textContent="Исполнение №2";floating.onclick=open;document.body.append(floating);
  const obs=new MutationObserver(()=>{const exist=els("button,a,[role=button]").some(x=>!x.closest("#t2-dialog")&&x.textContent.trim()==="Исполнение перевозок");floating.style.display=exist?"none":"block"});
  obs.observe(document.body,{childList:true,subtree:true});
  document.addEventListener("click",e=>{
    if(root.classList.contains("open"))return;
    const x=e.target.closest("button,a,[role=button]");
    if(x&&["Исполнение перевозок","Приёмка и завершение"].includes(x.textContent.trim())){
      e.preventDefault();e.stopImmediatePropagation();state.tab=x.textContent.trim()==="Исполнение перевозок"?"execution":"tasks";open();
    }
  },true);
  root.addEventListener("click",clicked);
  root.addEventListener("change",changed);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&root.classList.contains("open"))close()});
}
function open(){init();root.classList.add("open");document.body.style.overflow="hidden";render();loadList()}
function close(){root.classList.remove("open");document.body.style.overflow=""}
function render(){
 if(!root)return;
 el(".t2-sidebar",root).innerHTML=state.items.length?state.items.map(x=>`<button data-order="${E(x.order_code)}" class="${state.order===x.order_code?"selected":""}"><b>${E(x.registration_no||x.order_code)}</b><div>${E(x.order_code)}</div>${label(states[x.process_status]||"Ставка выбрана")}</button>`).join(""):"Выигранных заявок пока нет.";
 const d=state.data,content=el(".t2-content",root);
 const tabs=[["execution","Исполнение"],["documents","Документы / чат"],["tasks","Задачи ВЭД"],["transport","Транспортная заявка"],["claims","Претензия"],["faq","FAQ"]];
 content.innerHTML=flash()+(!d?group("Выберите перевозку","После выбора Владельцем победителя исполнение появится в этом разделе. ВЭД и Владелец видят все доступные по роли исполнения; перевозчик — только своё."):`${summary(d)}<nav class="t2-tabs">${tabs.map(([key,text])=>`<button data-tab="${key}" class="${state.tab===key?"selected":""}">${E(text)}</button>`).join("")}</nav>${state.tab==="execution"?execution(d):state.tab==="documents"?documents(d):state.tab==="tasks"?tasks(d):state.tab==="transport"?transport(d):state.tab==="claims"?claims(d):faq()}`);
}
function summary(d){
 const o=d.shipment,x=d.state||{};
 return group("Заявка "+(o.registration_no||o.order_code),`<dl class="t2-kv">${row("Заказ",o.order_code)}${row("Все Bitrix",o.bitrix_task)}${row("Перевозчик",o.carrier_login)}${row("Ставка",String(o.amount||"—")+" "+String(o.currency||""))}${row("Вид транспорта",o.mode)}${row("Маршрут",[o.origin,o.waypoints,o.destination].filter(Boolean).join(" → ")||o.route)}${row("Контакт отправителя",o.sender_contact)}${row("Исходный план выхода",x.original_departure||o.pickup)}${row("Статус",states[x.status]||"Ожидает принятия")}</dl>${!d.state&&d.role==="carrier"?`<p>${B("take","Принять перевозку в работу","primary")}</p>`:""}`);
}
function execution(d){
 const x=d.state||{},carrier=d.role==="carrier",locked=!carrier||!d.state||x.status==="completed";
 const plan=d.plans||[],points=d.points||[],actual=Boolean(x.actual_departure);
 return group("Исполнение и трекинг",`
 <p class="t2-meta">Перевозчик сохраняет всё одной кнопкой. Заявка от сохранения не закрывается. Исходная плановая дата заблокирована.</p>
 <div class="t2-grid">
 ${F("new_plan_date","+ Новая плановая дата выхода, Минск","datetime-local","",locked||actual)}
 ${F("new_plan_reason","Причина переноса","textarea","",locked||actual)}
 ${F("actual_departure","Фактическая дата выхода, Минск","datetime-local",dateInput(x.actual_departure),locked||actual)}
 ${F("container_no","№ контейнера","text","",locked)}
 ${F("location","Текущее местоположение груза","text","",locked)}
 ${F("location_date","Дата сведений, Минск","datetime-local","",locked)}
 ${F("location_comment","Комментарий к точке","textarea","",locked)}
 ${F("pto_date","Дата прибытия на ПТО, Минск","datetime-local",dateInput(x.pto_at),locked||Boolean(x.pto_at))}
 <label class="t2-field"><b><input type="checkbox" name="pto_yes" style="width:auto" ${x.pto_at?"checked":""} ${locked||x.pto_at?"disabled":""}> Прибыл на ПТО: Да <span class="t2-help" title="${E(descriptions.pto_yes)}">?</span></b>${label(descriptions.pto_yes)}</label>
 ${F("customs_date","Фактическая дата растаможки, Минск","datetime-local",dateInput(x.customs_at),locked||Boolean(x.customs_at))}
 </div>
 <div class="t2-actions">${carrier&&d.state&&x.status!=="completed"?B("save","Сохранить изменения","primary"):""}${B("csv-download","Скачать CSV-шаблон")}${B("csv-upload","Загрузить CSV")}<input type="file" id="t2-csv-file" accept=".csv" hidden></div>
 ${state.csv?csvPreview():""}
 `)+group("История выхода и контрольных точек",`
 <div><b>Переносы плановых дат</b>${plan.length?plan.map(i=>`<div class="t2-list">${E(dateText(i.planned_departure))} — ${E(i.reason||"Исходный план")}</div>`).join(""):"<p class='t2-meta'>Переносов не было</p>"}</div>
 <div><b>Номера контейнеров</b>${d.containers?.length?d.containers.map(i=>`<div class="t2-list">${E(i.container_no)}</div>`).join(""):"<p class='t2-meta'>Не указаны, продолжение работы разрешено</p>"}</div>
 <p>ПТО: ${E(dateText(x.pto_at))}, проверка ВЭД: ${x.pto_checked_at?"Выполнена":"Ожидается"}. Растаможка: ${E(dateText(x.customs_at))}. Склад: ${E(dateText(x.warehouse_at))}.</p>
 <table class="t2-table"><thead><tr><th>Дата</th><th>Точка</th><th>Осталось, км</th></tr></thead><tbody>${points.map(i=>`<tr><td>${E(dateText(i.observed_at))}</td><td>${E(i.location_text)}</td><td>${i.route_calculation_status==="verified"?E(i.remaining_km):"Не рассчитано"}</td></tr>`).join("")||"<tr><td colspan=3>Точек пока нет</td></tr>"}</tbody></table>
 ${points.length?`<p><a target="_blank" rel="noopener noreferrer" href="https://yandex.com/maps/?text=${encodeURIComponent(points.at(-1).location_text)}">Открыть последнюю контрольную точку на карте</a></p>`:""}<p class="t2-meta">Расстояние рассчитывается только при наличии достоверного маршрута для этого режима. Значения не придумываются.</p>
 `)+(d.role!=="carrier"&&x.status!=="completed"?group("Решение ВЭД / Владельца",`<p>Проверка обязательных этапов: <b>${d.canClose?"Завершены":"Не завершены"}</b>. Претензия: <b>${d.hasClaim?"Да":"Нет"}</b>.</p>${d.hasClaim?"Закрыть претензию можно только на вкладке «Претензия».":`<div class="t2-actions">${B("finish","Проверить возможность закрытия","primary")}${!d.containers?.length?B("finish-yes","Да — запросить контейнер")+B("finish-no","Нет — завершить без контейнера"):""}</div>`}<p class="t2-meta">Номер контейнера проверяется только при попытке закрытия. При «Да» создаётся задача перевозчику; при «Нет» исключение фиксируется в журнале.</p>`):"")+group("Журнал",d.events?.slice(0,25).map(i=>`<div class="t2-list">${E(i.action)} · ${E(i.actor)} · ${E(dateText(i.created_at))}</div>`).join("")||"Пока пусто");
}
function documents(d){
 const carriers=d.role==="carrier",active=!!d.state&&d.state.status!=="completed";
 return group("Запросить документы у ВЭД",`<p class="t2-meta">Отправлять запросы можно многократно; каждый запрос — отдельная задача ВЭД, с наследованием всех Bitrix.</p>${carriers&&active?`
 <select id="t2-kind"><option value="missing_documents">Недостающие документы</option><option value="transport_documents">Документы на перевозку</option></select>
 <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin:12px 0">${docs.map(([key,label])=>`<label><input type="checkbox" name="t2-doctype" style="width:auto" value="${key}"> ${E(label)}</label>`).join("")}</div>
 ${F("description","Какие документы нужны и почему?","textarea")}
 ${B("request_docs","Отправить запрос ВЭД","primary")}`:"Запрос создаёт только назначенный перевозчик, принявший перевозку в работу."}`)+group("Документы по перевозке",`<p class="t2-meta">Документы доступны Владельцу, ВЭД и выбранному перевозчику. Исходные документы Владельца остаются в начальном запросе.</p>${d.docs?.map(f=>`<div class="t2-list"><a href="${API}?order=${encodeURIComponent(d.shipment.order_code)}&download=${encodeURIComponent(f.id)}" data-file="${E(f.id)}">${E(f.name)}</a> · ${E(f.category)} · ${E(f.actor)}</div>`).join("")||"Пока нет файлов"}${active?`<p><input id="t2-files" type="file" multiple></p><p><select id="t2-file-type">${docs.map(([k,l])=>`<option value="${k}">${E(l)}</option>`).join("")}</select></p>${B("upload","Загрузить документы","primary")}`:""}`)+group("Общий чат по заявке",`<div style="max-height:220px;overflow:auto">${d.messages?.map(m=>`<div class="t2-list"><b>${E(m.sender_login)}</b> · ${E(dateText(m.created))}<p>${E(m.body)}</p></div>`).join("")||"Пока нет сообщений"}</div>${active?F("message","Новое сообщение","textarea")+B("message","Отправить в чат","primary"):""}`);
}
function tasks(d){
 const staff=d.role!=="carrier";
 return group("Задачи перевозки",`<p class="t2-meta">Перевозчик формирует повторные запросы. При ПТО и растаможке задания создаются один раз, независимо от повторного сохранения.</p>${d.tasks?.map(t=>`<div class="t2-list"><b>${E(taskNames[t.task_type]||t.task_type)}</b> · ${E(t.status)} <p>${E(t.description)}</p>${label("Рег. № "+t.registration_no+" / Все Bitrix: "+(t.inherited_bitrix_tasks||"—"))}
 ${staff&&t.status!=="completed"&&t.task_type!=="container_number"?`<div class="t2-actions">${t.task_type==="warehouse_acceptance"?`<label>Дата приёмки, Минск <input type="datetime-local" data-warehouse="${E(t.id)}"></label>`:""}${B("complete:"+t.id,"Выполнено","primary")}</div>`:""}</div>`).join("")||"<p>Открытых задач нет.</p>"}`);
}
function transport(d){
 const o=d.shipment||{},x=d.state||{},m=mode(o.mode),names={auto:"CMR / автомобиль",rail:"СМГС / вагон",air:"AWB / авиарейс",sea:"B/L / судно"};
 return group("Заполнение транспортной заявки",`<p class="t2-meta">Форма для ${E(names[m])}. Номер TR, весь список Bitrix, ставка, валюта и первоначальный план выхода заблокированы и подставляются автоматически.</p><dl class="t2-kv">${row("TR",o.registration_no)}${row("Заказ",o.order_code)}${row("Bitrix",o.bitrix_task)}${row("Ставка и валюта",o.amount+" "+o.currency)}${row("Первоначальная дата",x.original_departure||o.pickup)}</dl><div class="t2-grid">${F("transport_waybill",m==="auto"?"CMR":m==="rail"?"СМГС":m==="air"?"AWB":"Коносамент B/L")}${F("transport_consignee","Грузополучатель")}${F("transport_vehicle",m==="auto"?"Автомобиль / прицеп":m==="rail"?"Вагон / поезд":m==="air"?"Рейс":"Судно")}${F("transport_notes","Особые указания","textarea")}</div><div class="t2-actions">${B("transport-print","Сформировать транспортную заявку","primary")}</div>`);
}
const fields={auto:["Номер CMR","Автомобиль / прицеп","Водитель","Грузовые места"],rail:["№ СМГС","Поезд / вагон","Станция выдачи","Пломбы"],air:["AWB","Рейс","Аэропорты","Авиаперевозчик"],sea:["Коносамент B/L","Судно / рейс","Порты","Контейнер / пломба"]};
function mode(v){const s=String(v||"").toLowerCase();return /rail|жд|желез/.test(s)?"rail":/air|avia|авиа/.test(s)?"air":/sea|мор/.test(s)?"sea":"auto"}
function claims(d){
 const staff=d.role!=="carrier",m=mode(d.shipment?.mode);
 return group("Акты и претензии",`<p class="t2-meta">Документ зависит от транспорта. Если была претензия, итоговый статус «Выполнено» может установить только ВЭД либо Владелец — даже после согласования акта перевозчиком.</p>${d.acts?.map(a=>`<div class="t2-list"><b>Акт ${E(a.id.slice(0,8))}</b> / редакция ${a.revision} / ${E(a.state)}<p>${E(a.data?.description)}</p>${staff?B("printact:"+a.id,"Скачать акт"):""}${!staff&&a.state==="sent"?`${F("claim_reason","Причина несогласия (если есть)","textarea")}${B("accept:"+a.id,"Согласовать","primary")} ${B("dispute:"+a.id,"Отклонить","danger")}`:""}</div>`).join("")||"<p>Актов пока нет</p>"}${staff&&d.state?.status!=="completed"?`<div class="t2-grid">${F("claim_description","Описание претензии","textarea")}${F("claim_amount","Сумма/валюта")}${F("claim_evidence","Доказательства","textarea")}${fields[m].map((name,i)=>F("claim_mode_"+i,name)).join("")}</div><div class="t2-actions">${B("claim-draft","Сохранить проект")}${B("claim-send","Отправить акт на согласование","primary")}</div>${F("claim_reason","Решение по спору","textarea")}${B("claim-close","Завершить урегулированную перевозку","primary")}`:""}`);
}
function faq(){
 const entries=[
 ["Зачем два разных действия «Принять»?","До победителя — подготовка ставки. После выбора единственного победителя — отдельное принятие перевозки к исполнению."],
 ["Как формируются номера?","TR-YY-NNNNNN создаётся один раз. С нового календарного года по времени Минска начинается счётчик 000001. Исходный номер заказа и все Bitrix сохраняются."],
 ["Можно ли запросить документы снова?","Да. Каждый запрос создаёт отдельную задачу ВЭД, показывается в едином реестре задач и чате."],
 ["Как завершить без контейнера?","Если остальные этапы пройдены, ВЭД/Владелец выбирает «Да — запросить» либо «Нет — завершить без номера». Решение записывается."],
 ["Как работает ПТО?","После отметки перевозчика «Прибыл на ПТО» создаётся задача ВЭД на проверку комплекта документов."],
 ["Кому доступно завершение?","Только ВЭД или Владелец. Перевозчик не меняет окончательный статус."],
 ["А если была претензия?","Заполнение номера контейнера или согласие перевозчика с актом не закрывают заказ. Требуется явное решение ВЭД/Владельца."],
 ["Что с картой и километрами?","При добавлении точки карта обновляет местоположение. Километраж должен опираться на достоверный маршрут; если расчёт недоступен, выводится «не рассчитано»."],
 ["CSV-файл","Скачайте шаблон длинной формы, заполните только свои поля и загрузите файл назад. Просмотрите результат. Системные поля и первоначальные даты импортом не меняются."]
 ];
 return group("FAQ и подсказки",`<p>Знак <b>?</b> рядом с полем показывает его назначение. Одно действие находится в одном функциональном разделе.</p>${entries.map(([q,a])=>`<details class="t2-list"><summary>${E(q)}</summary><p>${E(a)}</p></details>`).join("")}`);
}
const csvKeys=["new_plan_date","new_plan_reason","actual_departure","location","location_date","location_comment","pto_yes","pto_date","customs_date","container_no"];
function download(name,data,mime="text/csv;charset=utf-8"){const u=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3500)}
function csvTemplate(){
 const old=state.data?.state||{};
 return "\uFEFFfield,value,hint\r\n"+csvKeys.map(k=>[k,({actual_departure:dateInput(old.actual_departure),pto_date:dateInput(old.pto_at),customs_date:dateInput(old.customs_at)}[k]||""),descriptions[k]].map(v=>`"${String(v||"").replace(/"/g,'""')}"`).join(",")).join("\r\n")+"\r\n";
}
function parseCsv(text){
 const header=text.replace(/^\uFEFF/,"").split(/\r?\n/)[0],sep=header.split(";").length>header.split(",").length?";":",";
 const rows=[],r=[],unused=null;let row=[],value="",inside=false;
 for(let i=0;i<text.length;i++){let c=text[i];if(i===0&&c==="\uFEFF")continue;
 if(c==='"'){if(inside&&text[i+1]==='"'){value+='"';i++}else inside=!inside}
 else if(c===sep&&!inside){row.push(value);value=""}
 else if((c==="\r"||c==="\n")&&!inside){if(c==="\r"&&text[i+1]==="\n")i++;row.push(value);if(row.some(Boolean))rows.push(row);row=[];value=""}
 else value+=c}
 if(inside)throw Error("Незакрытые кавычки CSV");row.push(value);if(row.some(Boolean))rows.push(row);
 const head=(rows.shift()||[]).map(x=>x.toLowerCase().trim()),ki=head.indexOf("field"),vi=head.indexOf("value");
 if(ki<0||vi<0)throw Error("Нужны заголовки field и value");
 let seen=new Set(),errors=[],items=[];
 rows.forEach((r,i)=>{const key=r[ki]?.trim(),val=r[vi]||"";if(!key||!val.trim())return;
 if(!csvKeys.includes(key))errors.push("Строка "+(i+2)+": нельзя импортировать "+key);
 else if(seen.has(key))errors.push("Дублирующее поле "+key);
 else {seen.add(key);items.push({key,value:val})}});
 return {items,errors};
}
function csvPreview(){const p=state.csv;return group("Предпросмотр CSV",`<p>Значений: ${p.items.length}; ошибок: ${p.errors.length}</p>${p.errors.map(x=>`<p class="t2-error">${E(x)}</p>`).join("")}<table class="t2-table">${p.items.map(x=>`<tr><td>${E(x.key)}</td><td>${E(x.value)}</td></tr>`).join("")}</table><div class="t2-actions">${B("csv-apply","Перенести значения в форму","primary")}${B("csv-cancel","Отмена")}</div><p>Нажмите «Сохранить изменения» после проверки. Пустые поля не стирают прежние данные.</p>`)}
function applyCsv(){
 if(state.csv.errors.length)throw Error("Исправьте ошибки CSV");
 for(const {key,value} of state.csv.items){const x=el(`[name="${key}"]`,root);if(!x||x.disabled)continue;
 if(x.type==="checkbox")x.checked=/^(да|true|yes|1)$/i.test(value);
 else x.value=x.type==="datetime-local"?value.slice(0,16):value;}
 state.csv=null;state.message="CSV перенесён в поля; нажмите «Сохранить изменения».";el(".t2-content",root).prepend(Object.assign(document.createElement("p"),{className:"t2-success",textContent:state.message}));
}
function getFields(){
 const names=csvKeys,x=state.data.state||{},fields={};
 for(const name of names){const control=el(`[name="${name}"]`,root);if(!control||control.disabled)continue;const value=control.type==="checkbox"?control.checked:control.value.trim();if(value===false||value==="")continue;
 fields[name]=control.type==="datetime-local"?iso(value):value}
 if(x.actual_departure)delete fields.actual_departure;
 return fields;
}
function printDoc(title,object){
 const html=`<!doctype html><html lang=ru><meta charset=utf-8><title>${E(title)}</title><style>body{font:14px/1.6 Arial;padding:30px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:7px;text-align:left}</style><h2>${E(title)}</h2><table>${Object.entries(object).map(([k,v])=>`<tr><th>${E(k)}</th><td>${E(v)}</td></tr>`).join("")}</table><p>Подпись _______________　　　 Дата _______________</p><button onclick="window.print()">Печать / Сохранить PDF</button></html>`;
 download(title.replace(/[^A-Za-zА-Яа-я0-9]/g,"_")+".html",html,"text/html;charset=utf-8");
}
async function clicked(e){
 const target=e.target.closest("[data-action],[data-order],[data-tab],[data-file]");if(!target)return;e.preventDefault();
 if(state.busy)return;
 const order=target.dataset.order,tab=target.dataset.tab,act=target.dataset.action;
 if(order){state.order=order;state.tab="execution";state.csv=null;try{await reload()}catch(err){state.error=err.message;render()}return}
 if(tab){state.tab=tab;state.error="";render();return}
 if(target.dataset.file){const res=await fetch(target.href);if(!res.ok){state.error="Не удалось скачать файл";render();return}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=target.textContent.trim();a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);return}
 if(act==="close")return close();
 if(act==="take")return perform("take");
 if(act==="save")return perform("save",{fields:getFields()});
 if(act==="csv-download")return download("task2-template.csv",csvTemplate());
 if(act==="csv-upload")return el("#t2-csv-file",root)?.click();
 if(act==="csv-apply"){try{applyCsv()}catch(err){state.error=err.message;render()}return}
 if(act==="csv-cancel"){state.csv=null;render();return}
 if(act==="request_docs"){let description=V("description");if(!description){state.error="Опишите недостающие документы";render();return}
 return perform("request_docs",{description,kind:el("#t2-kind",root)?.value||"missing_documents",types:els('[name="t2-doctype"]:checked',root).map(v=>v.value)})}
 if(act==="upload"){const files=Array.from(el("#t2-files",root)?.files||[]);if(!files.length){state.error="Выберите файлы";render();return}
 for(const f of files)await perform("upload",{category:el("#t2-file-type",root)?.value||"task2"},f);return}
 if(act==="message")return perform("message",{message:V("message")});
 if(act.startsWith("complete:")){const taskId=act.slice(9),x=el(`[data-warehouse="${taskId}"]`,root)?.value;return perform("complete_task",{taskId,date:iso(x||"")})}
 if(act==="finish")return perform("finish");
 if(act==="finish-yes")return perform("finish",{answer:"yes"});
 if(act==="finish-no")return perform("finish",{answer:"no"});
 if(act==="transport-print"){const o=state.data.shipment,x=state.data.state||{};return printDoc("Транспортная заявка "+o.registration_no,{
 "Регистрационный номер":o.registration_no,"Заказ":o.order_code,"Все номера Bitrix":o.bitrix_task,"Перевозчик":o.carrier_login,
 "Ставка":String(o.amount)+" "+o.currency,"Транспорт":o.mode,"Маршрут":o.route,
 "Исходная дата выхода":x.original_departure||o.pickup,
 "Транспортный документ":V("transport_waybill"),"Грузополучатель":V("transport_consignee"),
 "Рейс / средство":V("transport_vehicle"),"Примечания":V("transport_notes")})}
 if(act==="claim-draft"||act==="claim-send"){const payload={description:V("claim_description"),amount:V("claim_amount"),evidence:V("claim_evidence")};
 for(let i=0;i<4;i++)payload[fields[mode(state.data.shipment.mode)][i]]=V("claim_mode_"+i);
 return perform(act==="claim-draft"?"act_create":"act_send",{data:payload})}
 if(act.startsWith("accept:"))return perform("act_response",{actId:act.slice(7),response:"accept"});
 if(act.startsWith("dispute:"))return perform("act_response",{actId:act.slice(8),response:"dispute",reason:V("claim_reason")});
 if(act==="claim-close")return perform("claim_close",{reason:V("claim_reason")});
 if(act.startsWith("printact:")){const a=state.data.acts?.find(q=>q.id===act.slice(9));if(a){const o=state.data.shipment;return printDoc("Претензионный акт "+o.registration_no,{"TR":o.registration_no,"Заказ":o.order_code,"Bitrix":o.bitrix_task,"Редакция":a.revision,...a.data})}}
}
async function changed(e){
 if(e.target?.id==="t2-csv-file"){
  const f=e.target.files?.[0];if(!f)return;
  try{if(f.size>1024*1024)throw Error("Файл CSV слишком большой, максимум 1 МБ");state.csv=parseCsv(await f.text());state.error="";render()}
  catch(err){state.error=err.message;render()}
 }
}
document.addEventListener("DOMContentLoaded",init,{once:true});if(document.readyState!=="loading")init();
window.freightTask2Open=open;
})();
