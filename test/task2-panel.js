/* Issue #47 integrated staging UI; canonical place: Исполнение перевозок. */
(function(){
 "use strict";
 const uploadIds=new WeakMap();
 const pendingRequests=new Map();
 const eid="task2-root";
 const canonicalNavigation=()=>{if(location.hash==="#shipment-fulfillment")location.replace("#approved-shipments");};
 window.addEventListener("hashchange",canonicalNavigation);canonicalNavigation();
 const state={items:[],role:"",selected:"",detail:null,tab:"track",busy:false,notice:""};
 const docTypes=["Инвойс","Упаковочный лист","CMR","СМГС / ЦИМ-СМГС","Коносамент B/L","AWB","Экспортная декларация","Транзитная декларация","Сертификат","Фото погрузки","Страховой полис","Инструкция","MSDS / UN38.3","Другое"];
 const tabs=[["track","Исполнение и трекинг"],["overview","Данные заявки"],["documents","Документы и ВЭД"],["arrival","ПТО и приёмка"],["claims","Претензии и акты"],["history","История"]];
 const tips={
  number:"Номер контейнера. Необязателен до завершения; после запроса ВЭД укажите действительный номер.",
  actual:"Фактическая дата и время выхода груза. После сохранения первоначальная дата и все переносы остаются в истории.",
  plan:"Новая плановая дата выхода. Добавляйте любое количество раз, пока не указана фактическая дата.",
  reason:"Обязательно опишите объективную причину переноса; запись сохранится в истории.",
  location:"Место нахождения груза: город, терминал, станция, порт или адрес. Добавляется отдельной записью.",
  date:"Дата и время события; укажите время Минска или локальное время с пояснением.",
  description:"Опишите какие документы требуются, зачем и какие именно отсутствуют. Каждая отправка — отдельная задача ВЭД.",
  types:"Выберите несколько видов документов, если требуется. Вариант «Другое» позволяет уточнить запрос в описании.",
  task:"Связанная задача ВЭД, наследует все номера Bitrix исходного заказа. Не заменяет заказ.",
  comment:"Дополнительное пояснение, видимое ВЭД, перевозчику и Владельцу.",
  data:"Описание нарушения, недостачи или повреждения, основание и требование к перевозчику.",
  costs:"Сумма требований в валюте утверждённой ставки, если применимо.",
  doc:"Документ/фото доказательство. Загруженные файлы отображаются в документах и чате заявки.",
  message:"Общий чат именно этой выигранной перевозки: ВЭД, перевозчик и Владелец."
 };
 const stagingReg=n=>n?(String(n).startsWith("TEST-")?String(n):"TEST-"+String(n)):"";
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const fmt=s=>s?new Date(s).toLocaleString("ru-RU",{timeZone:"Europe/Minsk"}):"—";
 const minskISO=value=>{if(!value)throw Error("Укажите дату и время Минска");const str=String(value);const normalized=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)?str+":00+03:00":str;const d=new Date(normalized);if(Number.isNaN(d.getTime()))throw Error("Некорректная дата/время");return d.toISOString();};
 const badge=s=>'<span class="t2-badge">'+esc(s||"—")+"</span>";
 const field=(name,label,type,tip,extra="")=>'<label class="t2-field"><span>'+esc(label)+' <span class="t2-help" title="'+esc(tip||tips[name]||label)+'" aria-label="Подсказка: '+esc(label)+'">?</span></span>'+
   (type==="textarea"?'<textarea rows="3" name="'+esc(name)+'" '+extra+'></textarea>':
    type==="select"?'<select name="'+esc(name)+'" '+extra+'><option value="">Выберите…</option>'+docTypes.map(x=>'<option>'+esc(x)+'</option>').join("")+'</select>':
    '<input name="'+esc(name)+'" type="'+(type||"text")+'" '+extra+'>')+
   '<small>'+esc(tip||tips[name]||"")+'</small></label>';
 const readonly=(label,val)=>'<div class="t2-readonly"><small>'+esc(label)+'</small><strong>'+esc(val??"—")+'</strong></div>';
 const form=(kind,body,button="Сохранить изменения",hidden=false)=>
  '<form data-t2-form="'+kind+'" class="t2-form"><div class="t2-fields">'+body+'</div><div class="t2-csv"><button type="button" class="t2-btn ghost" data-t2-csv-download>Скачать CSV шаблон</button><label class="t2-btn ghost">Загрузить CSV<input data-t2-csv-upload type="file" accept=".csv,text/csv" hidden></label><span class="t2-csv-info"></span></div>'+
  (hidden?"":'<button class="t2-btn" type="submit">'+esc(button)+'</button>')+'</form>';
 const call=async(params,files)=>{
   const options={method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(params)};
   if(files){delete options.headers;options.body=files;}
   const res=await fetch("/api/task2",options);
   const body=await res.json().catch(()=>({error:"Неверный ответ API"}));
   if(!res.ok)throw Error(body.error||"Ошибка сервера");
   return body;
 };
 const get=async query=>{
   const res=await fetch("/api/task2"+query,{cache:"no-store"});
   const body=await res.json().catch(()=>({error:"Нет ответа API"}));
   if(!res.ok)throw Error(body.error||"Нет доступа");
   return body;
 };
 function alertText(msg,error=false){
   state.notice=(error?"Ошибка: ":"")+msg;
   const node=document.querySelector("#t2-alert");if(node){node.textContent=state.notice;node.className=error?"t2-alert error":"t2-alert";}
 }
 function getTarget(){return document.querySelector('.cabinet-panel[data-section="approved-shipments"]')}
 function show(){
   const pane=getTarget();if(!pane)return;
   if(!pane.querySelector("#"+eid)){
     const node=document.createElement("section");node.id=eid;node.className="t2-panel";pane.prepend(node);
   }
   const root=pane.querySelector("#"+eid);
   if(!root)return;
   const chosen=state.items.find(i=>i.order_code===state.selected),d=state.detail;
   const heading='<header class="t2-heading"><div><h2>Исполнение перевозок · Задача №2</h2><p>После выбора единственного победителя. Сбор ставок и согласование участия здесь не выполняются.</p></div><button data-t2-refresh class="t2-btn ghost" type="button">Обновить</button></header>';
   let html=heading+'<div id="t2-alert" class="t2-alert">'+esc(state.notice)+'</div>';
   if(!state.items.length){
     root.innerHTML=html+'<div class="t2-empty">Пока нет согласованной перевозки для этого кабинета. После выбора Владельцем одного победителя заявка появится здесь.</div>';
     return;
   }
   html+='<div class="t2-picker"><label>Перевозка <select id="t2-select">'+state.items.map(i=>'<option value="'+esc(i.order_code)+'" '+(state.selected===i.order_code?"selected":"")+'>'+
    esc((stagingReg(i.registration_no)||"TEST-TR —")+" · "+i.order_code+" · "+(i.process_status||"ожидает"))+'</option>').join("")+'</select></label></div>';
   if(!d){root.innerHTML=html+'<p>Открываем данные заявки…</p>';return;}
   const o=d.shipment,x=d.state||{},carrier=d.role==="carrier",staff=!carrier,started=!!d.state;
   html+='<div class="t2-context">'+readonly("Рег. №",stagingReg(o.registration_no)||"не присвоен")+readonly("Заказ",o.order_code)+readonly("№ Bitrix — все связанные",o.bitrix_task||"—")+
     readonly("Выбранный перевозчик",o.carrier_login)+readonly("Статус",x.status||"Ожидает принятия")+'</div>';
   if(!started){
     html+='<div class="t2-empty">Ставка выбрана, документы и исходные данные доступны для сверки. '+(carrier?'<button type="button" class="t2-btn" data-t2-action="take">Взять перевозку в работу</button>':'Ожидается действие выбранного перевозчика.')+'</div>';
   }else{
     html+='<nav class="t2-tabs">'+tabs.map(([key,title])=>'<button type="button" data-t2-tab="'+key+'" class="'+(state.tab===key?"active":"")+'">'+esc(title)+'</button>').join("")+'</nav>';
     html+='<div class="t2-stage">'+renderTab(d,carrier,staff)+'</div>';
   }
   root.innerHTML=html;
 }
 function renderTab(d,carrier,staff){
   const o=d.shipment,x=d.state||{},plans=d.plans||[],pts=d.points||[],tasks=d.tasks||[],cs=d.containers||[];
   const readHeader='<p class="t2-muted">Ставка и валюта выбраны Владельцем и недоступны для повторного согласования. Все номера Bitrix наследуются исходным заказом.</p>';
   if(state.tab==="overview"){
     const price=o.amount==null?"—":o.amount+" "+(o.currency||"");
     return readHeader+'<div class="t2-facts">'+readonly("Ставка победителя",price)+readonly("Транспорт",o.mode)+readonly("Маршрут",o.route)+readonly("Груз",o.cargo)+readonly("Вес/объём",(o.weight||"—")+" / "+(o.volume||"—"))+
      readonly("Контакт отправителя",o.sender_contact)+readonly("Исходная плановая дата выхода",x.original_departure||o.pickup||"—")+readonly("Фактическая дата выхода",x.actual_departure?fmt(x.actual_departure):"Не указана")+'</div>'+
      
      '<h3>Указанные контейнеры</h3><div class="t2-stack">'+(cs.length?cs.map(c=>readonly("Контейнер",c.container_no)).join(""):'<p class="t2-muted">Номер пока не указан.</p>')+'</div>'+
      '<p class="t2-muted">Основная кнопка «Сохранить изменения» сохраняет данные без закрытия перевозки.</p>';
   }
   if(state.tab==="documents"){
     let html='<h3>Документы по перевозке</h3><p class="t2-muted">Исходные файлы Владельца и документы ВЭД/перевозчика доступны в одном месте.</p><p><button type="button" class="t2-btn ghost" data-t2-open-transport>Открыть транспортную заявку · документ</button></p><div class="t2-stack">'+(d.docs||[]).map(f=>'<div class="t2-item"><span>'+esc(f.name)+' <small>'+esc(f.category)+'</small></span><button class="t2-btn ghost" data-t2-doc="'+esc(f.id)+'">Скачать</button></div>').join("")+'</div>';
     html+='<h3>Запросы и задачи ВЭД</h3><div class="t2-stack">'+tasks.filter(t=>["missing_documents","transport_documents","container_number"].includes(t.task_type)).map(taskCard).join("")+'</div>';
     if(carrier&&x.status!=="completed"){
       html+='<h3>Запросить документы у ВЭД</h3>'+form("request_docs",'<label class="t2-field"><span>Тип запроса</span><select name="kind"><option value="missing_documents">Недостающие документы</option><option value="transport_documents">Документы на перевозку</option></select><small>Можно отправлять запросы несколько раз; каждый станет отдельным заданием ВЭД.</small></label>'+
        field("description","Что требуется?","textarea")+'<label class="t2-field"><span>Типы документов <span class="t2-help" title="Для нескольких документов удерживайте Ctrl или Shift">?</span></span><select name="types" multiple size="7">'+docTypes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("")+'</select><small>Можно выбрать несколько видов документов и уточнить список в описании.</small></label>',"Направить запрос ВЭД");
     }
     if(x.status!=="completed"){
       html+='<h3>Прикрепить документы</h3><form class="t2-form" data-t2-form="upload"><label class="t2-field"><span>Документы (несколько файлов)</span><input type="file" name="files" multiple required><small>PDF, Excel, Word, фото, архивы; до 10 МБ на файл, каждый файл будет виден в задаче и общем чате.</small></label>'+
       (staff?'<label class="t2-field"><span>Задача ВЭД</span><select name="taskId"><option value="">Общие документы заявки</option>'+tasks.filter(t=>["missing_documents","transport_documents"].includes(t.task_type)).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.description.slice(0,80))+'</option>').join("")+'</select></label>':"")+
       '<button type="submit" class="t2-btn">Загрузить документы</button></form>';
     }
     html+='<h3>Общий чат: ВЭД · перевозчик · Владелец</h3><div class="t2-chat">'+(d.messages||[]).map(m=>'<p><small>'+esc(m.sender_login)+' · '+fmt(m.created)+'</small><span>'+esc(m.body)+'</span></p>').join("")+'</div>';
     if(x.status!=="completed")html+=form("message",field("message","Сообщение","textarea"),"Отправить сообщение");
     return html;
   }
   if(state.tab==="track"){
     const sourceDate=x.original_departure||o.pickup||"—";
     let html='<div class="t2-facts">'+readonly("Исходная плановая дата (заблокирована)",sourceDate)+readonly("Фактическая дата выхода",fmt(x.actual_departure))+
       readonly("ПТО",fmt(x.pto_at))+readonly("Дата завершения таможенного оформления",fmt(x.customs_at))+readonly("Дата приёмки груза на складе",fmt(x.warehouse_at))+
       readonly("Общая длина маршрута, км",d.route?.total_km??"не рассчитано")+readonly("Осталось по маршруту, км",d.route?.remaining_km??"не рассчитано")+'</div>';
     if(carrier&&x.status!=="completed"){
       html+='<h3>Обновить данные перевозки</h3><p class="t2-muted">Одна кнопка «Сохранить изменения» сохраняет даты, номер контейнера и новые точки, но не завершает заявку. Старые точки и переносы не изменяются.</p>';
       html+=form("save",'<div class="t2-block-title">Даты отправления</div>'+
         field("new_plan_date","+ Новая плановая дата выхода (Минск)","datetime-local",tips.plan,x.actual_departure?"disabled":"")+
         field("new_plan_reason","Причина переноса","textarea",tips.reason,x.actual_departure?"disabled":"")+
         field("actual_departure","Фактическая дата выхода (Минск)","datetime-local",tips.actual,x.actual_departure?"disabled":"")+
         '<div class="t2-block-title">Местоположение</div>'+
         field("location","Местонахождение груза","text",tips.location)+
         field("location_date","Дата и время контрольной точки (Минск)","datetime-local",tips.date)+
         field("location_comment","Примечание к точке","textarea",tips.comment)+
         '<div class="t2-block-title">ПТО и таможня</div>'+
         (x.pto_at?readonly("Прибыл на ПТО",fmt(x.pto_at)):
           '<label class="t2-field"><span>Прибыл на ПТО?</span><select name="pto_yes"><option value="">Нет</option><option value="yes">Да — создать задачу ВЭД</option></select><small>После «Да» создаётся только одна задача проверки документов.</small></label>'+
           field("pto_date","Дата прибытия на ПТО (Минск)","datetime-local",tips.date))+
         (x.customs_at?readonly("Дата завершения таможенного оформления",fmt(x.customs_at)):field("customs_date","Дата завершения импортного таможенного оформления (Минск)","datetime-local",tips.date))+
         '<div class="t2-block-title">Контейнеры</div>'+
         field("container_no","№ контейнера (необязательно)","text",tips.number),
         "Сохранить изменения");
     }
     html+='<h3>История переносов плановой даты</h3><div class="t2-stack">'+(plans.length?plans.map(p=>'<div class="t2-item">'+fmt(p.planned_departure)+' · '+esc(p.reason||"Исходная дата")+'</div>').join(""):'<p class="t2-muted">Переносов ещё не было. Исходный план сохраняется.</p>')+'</div>';
     html+='<h3>Контейнеры</h3><div class="t2-stack">'+(cs.length?cs.map(c=>readonly("№",c.container_no)).join(""):'<p class="t2-muted">Номер не указан; продолжение работы разрешено.</p>')+'</div>';
     html+='<h3>Движение груза</h3><div class="t2-stack">'+(pts.length?pts.map(p=>'<div class="t2-item"><div><strong>'+esc(p.location_text)+'</strong><br><small>'+fmt(p.observed_at)+' · '+esc(p.comment||"")+'</small></div><small>Осталось км: '+esc(p.remaining_km??"не рассчитано")+'</small></div>').join(""):'<p class="t2-muted">Контрольных точек пока нет.</p>')+'</div>';
     if(pts.length){
       const place=pts[pts.length-1].location_text;
       html+='<h3>Карта местоположения</h3><iframe class="t2-map" loading="lazy" title="Карта груза" src="https://yandex.ru/map-widget/v1/?text='+encodeURIComponent(place)+'"></iframe><p><a target="_blank" rel="noopener noreferrer" href="https://yandex.ru/maps/?text='+encodeURIComponent(place)+'">Открыть карту</a></p>';
     }
     html+='<p class="t2-muted">Автоматические километры рассчитываются только при наличии подтверждённого маршрута. Для недоступных режимов показано «не рассчитано» без фиктивного значения.</p>';
     return html;
   }
   if(state.tab==="arrival"){
     let html='<div class="t2-facts">'+readonly("ПТО",fmt(x.pto_at))+readonly("Проверка ВЭД",fmt(x.pto_checked_at))+readonly("Дата завершения таможенного оформления",fmt(x.customs_at))+readonly("Дата приёмки груза на складе",fmt(x.warehouse_at))+'</div>';
     html+='<p class="t2-muted">Перевозчик вводит даты в единой форме «Исполнение и трекинг». Здесь ВЭД выполняет задачи и принимает решение о завершении.</p>';
     html+='<h3>Задачи проверки документов и склада</h3><div class="t2-stack">'+tasks.filter(t=>["pto_review","warehouse_acceptance"].includes(t.task_type)).map(taskCard).join("")+'</div>';
     if(staff&&x.status!=="completed"){
       html+='<p>Если обязательные этапы завершены, ВЭД или Владелец может проверить возможность закрытия.</p>';
       html+='<button class="t2-btn" type="button" data-t2-action="finish">Проверить и завершить</button>';
       html+=' <button class="t2-btn ghost" type="button" data-t2-tab="claims">Оформить претензию</button>';
     }
     return html;
   }
   if(state.tab==="claims"){
     const acts=d.acts||[];
     let html='<p class="t2-muted">Претензия может закрываться только ВЭД/Владельцем, даже после согласования акта перевозчиком или указания номера контейнера.</p>';
     html+='<div class="t2-stack">'+acts.map(a=>'<div class="t2-item"><span><strong>Акт · '+esc(a.transport)+'</strong><br><small>Редакция '+a.revision+' · '+esc(a.state)+' · '+fmt(a.changed_at)+'</small><br>'+esc(a.data?.description||"")+'</span>'+
       '<button class="t2-btn ghost" data-t2-act-download="'+esc(a.id)+'">Распечатать акт / PDF</button>'+
       (carrier&&a.state==="sent"?'<button class="t2-btn" data-t2-act-response="accept" data-id="'+esc(a.id)+'">Согласовать</button><button class="t2-btn danger" data-t2-act-response="dispute" data-id="'+esc(a.id)+'">Не согласовать</button>':"")+'</div>').join("")+'</div>';
     if(staff&&x.status!=="completed"){
       const mode=String(o.mode||"").toLowerCase(),rail=mode.includes("rail")||mode.includes("жд"),air=mode.includes("air")||mode.includes("авиа"),sea=mode.includes("sea")||mode.includes("море");
       const extras=rail?[["smgs","№ накладной СМГС"],["station","Станции / вагоны"],["seals","Пломбы / контейнер"]]:
         air?[["awb","№ авианакладной AWB"],["flight","Номер рейса"],["airports","Аэропорты"]]:
         sea?[["bill","№ коносамента B/L"],["vessel","Судно / рейс"],["ports","Порты / пломбы"]]:
             [["cmr","№ CMR"],["vehicle","Автомобиль / прицеп"],["driver","Водитель / место разгрузки"]];
       html+='<h3>Составить акт по виду транспорта: '+esc(rail?"ЖД":air?"Авиа":sea?"Море":"Авто")+'</h3>';
       html+=form("act",field("description","Основание и обстоятельства","textarea")+field("costs","Сумма требований","text")+field("comment","Требования / пояснения","textarea")+
         extras.map(([id,label])=>field(id,label,"text")).join("")+
         '<label class="t2-field"><span>Статус</span><select name="action"><option value="act_send">Сформировать и отправить перевозчику</option><option value="act_create">Сохранить черновик</option></select></label>',
         "Сохранить акт");
       if(d.hasClaim)html+='<h3>Итоговое решение по претензии</h3>'+form("claim_close",field("reason","Основание завершения спорной перевозки","textarea","При спорном акте решение обязательно"),"Закрыть претензионную перевозку");
     }
     return html;
   }
   if(state.tab==="history"){
     return '<h3>Журнал действий</h3><div class="t2-stack">'+(d.events||[]).map(e=>'<div class="t2-item"><span>'+esc(e.action)+' · '+esc(e.actor)+' <small>('+esc(e.role)+')</small></span><small>'+fmt(e.created_at)+'</small></div>').join("")+'</div>';
   }
   return "";
 }
 function taskCard(t){
   const active=t.status!=="completed"&&t.status!=="cancelled",staff=state.role==="owner"||state.role==="logistic";
   return '<article class="t2-item"><div><strong>'+esc(t.task_type)+'</strong> '+badge(t.status)+'<p>'+esc(t.description)+'</p><small>№ Bitrix: '+esc(t.inherited_bitrix_tasks||"—")+'</small></div>'+
      (staff&&active?'<button type="button" class="t2-btn" data-t2-task-complete="'+esc(t.id)+'" data-kind="'+esc(t.task_type)+'">Завершить задачу ВЭД</button>':"")+'</article>';
 }
 async function loadList(){
   const list=await get("");
   state.role=list.role;state.items=list.items||[];
   if(!state.items.some(o=>o.order_code===state.selected))state.selected=state.items[0]?.order_code||"";
   await loadDetail();
 }
 async function loadDetail(){
   state.detail=state.selected?await get("?order="+encodeURIComponent(state.selected)):null;
   state.notice="";show();
 }
 async function update(action,fields,files){
   if(state.busy)return;
   state.busy=true;alertText("Сохраняем…");
   try{
     const payload={action,order:state.selected,...fields};
     const requestKey=JSON.stringify(payload);
     if(action==="request_docs"){
       if(!pendingRequests.has(requestKey))pendingRequests.set(requestKey,crypto.randomUUID());
       payload.requestId=pendingRequests.get(requestKey);
     }
     const res=await call(payload,files);
     if(action==="request_docs")pendingRequests.delete(requestKey);
     let routeNote="";
     if(action==="save"&&fields.fields?.location&&state.detail?.shipment){
       const o=state.detail.shipment,mode=String(o.mode||"").toLowerCase();
       if(/авто|auto|road/.test(mode)&&o.origin&&o.destination){
         try{
           const mid=String(o.waypoints||"").split(/[;,\n]/).map(x=>x.trim()).filter(Boolean).slice(0,6);
           const addresses=[o.origin,...mid,o.destination];
           const first=await fetch("/api/route-distance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transport:"Авто",addresses})});
           const route=await first.json();
           if(!first.ok)throw Error(route.error||"Не удалось рассчитать маршрут");
           const km=await call({action:"route_metrics",order:state.selected,routeKey:route.key});
           routeNote=" Авто: "+km.remainingKm+" км осталось из "+km.totalKm+" км ("+km.source+").";
         }catch(e){routeNote=" Километраж пока не рассчитан: "+e.message;}
       }
     }
     let result=res;
     if(res.needsContainerDecision){
       const yes=window.confirm("Номер контейнера не указан. Отправить перевозчику запрос на заполнение?\nОК = Да, отправить запрос.\nОтмена = Нет, завершить без номера.");
       result=await call({...payload,answer:yes?"yes":"no"});
     }
     await loadList();
     alertText((result.waitingContainer?"Создана задача перевозчику на заполнение номера контейнера.":result.finished?"Перевозка завершена.":"Изменения сохранены.")+routeNote);
     return result;
   }catch(e){alertText(e.message||"Ошибка",true);return {ok:false};}finally{state.busy=false;}
 }
 async function downloadDoc(id){
   try{
     const r=await fetch("/api/task2?order="+encodeURIComponent(state.selected)+"&download="+encodeURIComponent(id));
     if(!r.ok){const a=await r.json().catch(()=>({}));throw Error(a.error||"Ошибка скачивания");}
     const blob=await r.blob(),link=document.createElement("a"),url=URL.createObjectURL(blob);
     link.href=url;link.download=(state.detail?.docs||[]).find(x=>x.id===id)?.name||"document";link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
   }catch(e){alertText(e.message,true);}
 }
 function exportAct(id){
   const d=state.detail,a=(d?.acts||[]).find(x=>x.id===id);if(!a)return;
   const o=d.shipment,values=a.data||{},title={auto:"Акт по автомобильной перевозке",rail:"Акт по железнодорожной перевозке",air:"Акт по авиационной перевозке",sea:"Акт по морской перевозке"}[a.transport]||"Акт";
   const rows=[["Рег. № заявки",stagingReg(o.registration_no)],["Номер заказа",o.order_code],["Номера Bitrix",o.bitrix_task],["Перевозчик",o.carrier_login],["Маршрут",o.route],["Ставка",String(o.amount??"")+" "+(o.currency||"")],["Редакция",a.revision],["Дата",fmt(a.created_at)],...Object.entries(values)];
   const html='<!doctype html><html lang="ru"><meta charset="UTF-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;margin:45px;color:#16212b}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:20px 0}td{border:1px solid #a9afb5;padding:9px;vertical-align:top}td:first-child{width:35%;background:#f5f7f9}footer{margin-top:60px;display:flex;justify-content:space-between}</style><h1>'+esc(title)+'</h1><p>Регистрационный номер '+esc(o.registration_no)+'</p><table>'+rows.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join("")+'</table><footer><span>Представитель заказчика __________</span><span>Представитель перевозчика __________</span></footer><p>Статус согласования: '+esc(a.state)+'</p></html>';
   const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
   const link=document.createElement("a");link.href=url;link.download="Act_"+(o.registration_no||"TR")+"_rev"+a.revision+".html";link.click();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
   alertText("Акт сформирован. Откройте файл и используйте «Печать → Сохранить как PDF».");
 }
 const csv={
   quote(s){
     s=String(s??"");
     // Protect Excel from formula injection without corrupting negative numbers.
     if(/^[=+@]/.test(s))s="'"+s;
     return '"'+s.replace(/"/g,'""')+'"';
   },
   save(content,name){
     const url=URL.createObjectURL(new Blob(["\uFEFF",content],{type:"text/csv;charset=utf-8"}));
     const link=document.createElement("a");link.href=url;link.download=name;link.click();
     setTimeout(()=>URL.revokeObjectURL(url),10000);
   },
   parse(content){
     let text=String(content||"").replace(/^\uFEFF/,"").replace(/^sep=;\r?\n/i,"");
     if(!text.trim())throw Error("CSV пустой");
     if(text.length>1024*1024)throw Error("CSV превышает 1 МБ");
     const counts={";":0,",":0,"\t":0};
     let quoted=false;
     for(let i=0;i<text.length;i++){
       const c=text[i];
       if(c==='"'){
         if(quoted&&text[i+1]==='"'){i++;continue;}
         quoted=!quoted;
       }else if(!quoted&&(c==="\r"||c==="\n"))break;
       else if(!quoted&&Object.prototype.hasOwnProperty.call(counts,c))counts[c]++;
     }
     const delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
     if(!counts[delimiter])throw Error("В CSV не обнаружены столбцы с заголовками");
     const rows=[];let row=[],cell="";quoted=false;
     for(let i=0;i<text.length;i++){
       const c=text[i];
       if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
       else if(c===delimiter&&!quoted){row.push(cell);cell="";}
       else if((c==="\n"||c==="\r")&&!quoted){
         if(c==="\r"&&text[i+1]==="\n")i++;
         row.push(cell);if(row.some(x=>x!==""))rows.push(row);
         row=[];cell="";
       }else cell+=c;
     }
     if(quoted)throw Error("CSV: незакрытая кавычка");
     row.push(cell);if(row.some(x=>x!==""))rows.push(row);
     if(rows.length!==2)throw Error("Для одной формы нужны заголовки и одна строка данных");
     if(rows[0].length!==rows[1].length)throw Error("В строке данных и заголовке разное количество столбцов");
     return rows;
   },
   controls(form){return Array.from(form.querySelectorAll('input[name]:not([type=file]):not([type=hidden]),textarea[name],select[name]')).filter(f=>!f.disabled&&!f.readOnly&&f.name!=="action");},
   raw(f){return f.multiple?Array.from(f.selectedOptions).map(o=>o.value).join("|"):f.type==="checkbox"?(f.checked?"true":"false"):f.value;},
   download(form){
     const fields=csv.controls(form);
     csv.save("sep=;\r\n"+fields.map(f=>csv.quote(f.name)).join(";")+"\r\n"+fields.map(f=>csv.quote(csv.raw(f))).join(";")+"\r\n","task2-"+form.dataset.t2Form+".csv");
   },
   normalize(f,raw){
     const value=String(raw);
     const validDate=iso=>{
       const parsed=new Date(iso+"T00:00:00Z");
       return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso;
     };
     if(f.type==="date"){
       const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
       const iso=match?match[3]+"-"+match[2]+"-"+match[1]:value;
       if(!validDate(iso))throw Error("Дата "+f.name+": используйте действительную дату YYYY-MM-DD либо ДД.ММ.ГГГГ");
       return iso;
     }
     if(f.type==="datetime-local"){
       const match=/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/.exec(value);
       if(!match||!validDate(match[1]))throw Error("Дата/время "+f.name+": YYYY-MM-DD HH:mm");
       const [hours,mins]=match[2].split(":").map(Number);
       if(hours>23||mins>59)throw Error("Некорректное время: "+f.name);
       return match[1]+"T"+match[2];
     }
     if(f.type==="number"&&(!value.trim()||!Number.isFinite(Number(value.replace(",",".")))))
       throw Error("Неверное число: "+f.name);
     if(f.type==="number")return value.replace(",",".");
     if(f.type==="checkbox"){
       if(/^(да|yes|true|1)$/i.test(value))return true;
       if(/^(нет|no|false|0)$/i.test(value))return false;
       throw Error("Для "+f.name+" укажите Да или Нет");
     }
     if(f.tagName==="SELECT"){
       const options=Array.from(f.options);
       if(f.multiple){
         const values=value.split("|").map(x=>x.trim()).filter(Boolean);
         for(const v of values)if(!options.some(o=>o.value===v))throw Error("Неизвестный вариант "+v+" в "+f.name);
         return values;
       }
       if(!options.some(o=>o.value===value))throw Error("Неизвестный вариант "+value+" в "+f.name);
     }
     return value;
   },
   async upload(form,file){
     if(!file)throw Error("Выберите CSV-файл");
     const [headers,values]=csv.parse(await file.text()),fields=csv.controls(form),byName=new Map(fields.map(f=>[f.name,f]));
     if(new Set(headers).size!==headers.length)throw Error("CSV содержит повторяющиеся названия столбцов");
     const unknown=headers.filter(name=>!byName.has(name));
     if(unknown.length)throw Error("Неизвестные поля CSV: "+unknown.join(", "));
     // Validate the entire row before mutating even the first control.
     const changes=headers.map((name,i)=>({f:byName.get(name),raw:values[i]??""}))
       .filter(x=>x.f&&x.raw!=="")
       .map(x=>({...x,value:csv.normalize(x.f,x.raw)}));
     if(!changes.length)throw Error("В CSV нет заполненных значений для переноса");
     const preview=changes.map(({f,raw})=>f.name+": "+String(csv.raw(f)||"—")+" → "+raw).join("\n");
     if(!window.confirm("Предпросмотр переноса ("+changes.length+" полей):\n"+preview.slice(0,8000)+"\n\nПеренести в форму? Сохранение на сервере выполняется отдельно."))return;
     for(const {f,value} of changes){
       if(f.type==="checkbox")f.checked=value;
       else if(f.multiple){for(const option of f.options)option.selected=value.includes(option.value);}
       else f.value=value;
       if(!f.multiple&&f.type!=="checkbox"&&f.value!==value)
         throw Error("Поле "+f.name+" не приняло значение. Проверьте допустимый формат.");
       f.dispatchEvent(new Event("input",{bubbles:true}));
       f.dispatchEvent(new Event("change",{bubbles:true}));
     }
     form.dataset.t2CsvFields=JSON.stringify(changes.map(x=>x.f.name));
     alertText("CSV перенесён в "+changes.length+" полей. Проверьте данные и нажмите штатную кнопку сохранения.");
   }
 };
 async function onSubmit(ev){
   const f=ev.target.closest("form[data-t2-form]");if(!f)return;ev.preventDefault();
   const data=Object.fromEntries(new FormData(f).entries());const kind=f.dataset.t2Form;
   const csvMeta=f.dataset.t2CsvFields?{form:kind,changedFields:JSON.parse(f.dataset.t2CsvFields)}:undefined;
   if(kind==="upload"){
     const files=f.querySelector('input[type=file]')?.files||[];
     if(!files.length){alertText("Выберите файлы",true);return;}
     for(const file of files){const fd=new FormData();fd.append("action","upload");fd.append("order",state.selected);fd.append("file",file);fd.append("category","task2");if(data.taskId)fd.append("taskId",data.taskId);
       if(!uploadIds.has(file))uploadIds.set(file,crypto.randomUUID());
       fd.append("uploadId",uploadIds.get(file));
       const saved=await update("upload",{},fd);
       if(!saved?.ok)return;
     }return;
   }
   if(kind==="save"){
     const fields={};
     for(const [key,value] of Object.entries(data)){
       if(value===""||key==="__method")continue;
       if(key==="pto_yes"){fields.pto_yes=value==="yes";continue;}
       fields[key]=["new_plan_date","actual_departure","location_date","pto_date","customs_date"].includes(key)?minskISO(value):value;
     }
     if(fields.new_plan_date&&!fields.new_plan_reason){alertText("Укажите причину переноса плановой даты",true);return;}
     if(fields.location&&!fields.location_date){alertText("Укажите дату контрольной точки",true);return;}
     if(fields.pto_yes&&!fields.pto_date){alertText("Укажите дату прибытия на ПТО",true);return;}
     return update("save",{fields,...(csvMeta?{csv:csvMeta}:{})});
   }
   if(kind==="request_docs")data.types=Array.from(f.querySelector('select[name="types"]')?.selectedOptions||[]).map(x=>x.value);
   if(kind==="act"){
     const action=data.action;delete data.action;const latest=state.detail?.acts?.[0];return update(action,{data,...(latest&&["draft","disputed","sent"].includes(latest.state)?{expectedRevision:latest.revision}:{}),...(csvMeta?{csv:csvMeta}:{})});
   }
   if(kind==="pto")return update("pto",{date:data.date?minskISO(data.date):"",arrived:data.arrived==="yes"});
   if(["new_plan","actual_departure","location","customs"].includes(kind)&&data.date){try{data.date=minskISO(data.date);}catch(e){alertText(e.message,true);return;}}
   return update(kind,{...data,...(csvMeta?{csv:csvMeta}:{})});
 }
 async function onClick(ev){
   const hit=ev.target.closest("[data-t2-action],[data-t2-tab],[data-t2-doc],[data-t2-open-transport],[data-t2-task-complete],[data-t2-act-response],[data-t2-act-download],[data-t2-refresh],[data-t2-csv-download]");
   if(!hit)return;
   if(hit.hasAttribute("data-t2-csv-download"))return csv.download(hit.closest("form"));
   if(hit.hasAttribute("data-t2-refresh")){try{await loadList();}catch(e){alertText(e.message,true);}return;}
   if(hit.dataset.t2Tab){state.tab=hit.dataset.t2Tab;show();return;}
   if(hit.hasAttribute("data-t2-open-transport")){
     const candidates=Array.from(document.querySelectorAll("button,a,[role=button]")).filter(x=>!x.closest("#task2-root")&&x.textContent.trim().includes("Транспортная заявка"));
     const destination=candidates[0];
     if(!destination){alertText("Раздел транспортной заявки временно недоступен; проверьте меню кабинета.",true);return;}
     destination.click();return;
   }
   if(hit.dataset.t2Doc){await downloadDoc(hit.dataset.t2Doc);return;}
   if(hit.dataset.t2ActDownload){exportAct(hit.dataset.t2ActDownload);return;}
   if(hit.dataset.t2TaskComplete){
     const kind=hit.dataset.kind;
     let payload={taskId:hit.dataset.t2TaskComplete};
     if(kind==="warehouse_acceptance"){
       const answer=window.prompt("Дата фактической приёмки на складе (YYYY-MM-DDTHH:mm)",new Date().toISOString().slice(0,16));
       if(!answer)return;payload.date=minskISO(answer);
     }else if(!window.confirm("Завершить задачу ВЭД после проверки документов?"))return;
     await update("complete_task",payload);return;
   }
   if(hit.dataset.t2ActResponse){
     const response=hit.dataset.t2ActResponse;
     const reason=response==="dispute"?window.prompt("Обязательная причина отказа в согласовании акта:",""):"";
     if(response==="dispute"&&!reason)return;
     if(response==="accept"&&!window.confirm("Согласовать текущую редакцию акта? Это не закроет перевозку с претензией."))return;
     const act=state.detail?.acts?.find(x=>x.id===hit.dataset.id);
     await update("act_response",{actId:hit.dataset.id,revision:act?.revision,response,reason});return;
   }
   if(hit.dataset.t2Action==="finish"){await update("finish",{});return;}
   if(hit.dataset.t2Action==="take"){await update("take",{});return;}
 }
 function addHints(){
   document.querySelectorAll(".cabinet-panel label").forEach(label=>{
     if(label.closest("#task2-root")||label.dataset.t2HintAttached||label.dataset.task2Explained)return;
     const control=label.querySelector("input,textarea,select");if(!control)return;
     const caption=label.textContent.trim().slice(0,90);
     if(!caption||control.type==="hidden")return;
     label.dataset.t2HintAttached="1";
     if(!control.title)control.title="Поле: "+caption+". Укажите данные согласно назначению; для подробных инструкций откройте Помощь / FAQ.";
     const q=document.createElement("span");q.className="t2-legacy-hint";q.title=control.title;q.textContent=" ⓘ";
     label.append(q);
   });
 }
 let attached=false,queue=false;
 function mount(){
   if(queue)return;queue=true;requestAnimationFrame(async()=>{
     queue=false;addHints();
     const pane=getTarget();if(!pane||pane.querySelector("#"+eid))return;
     const node=document.createElement("section");node.id=eid;pane.prepend(node);show();
     try{await loadList();}catch(e){alertText(e.message||"Не удалось загрузить исполнение",true);}
   });
 }
 document.addEventListener("click",ev=>{onClick(ev).catch(e=>alertText(e.message,true));});
 document.addEventListener("submit",ev=>{onSubmit(ev).catch(e=>alertText(e.message,true));});
 document.addEventListener("change",async ev=>{
   if(ev.target.id==="t2-select"){state.selected=ev.target.value;try{await loadDetail();}catch(e){alertText(e.message,true);}}
   if(ev.target.hasAttribute("data-t2-csv-upload")){
     try{await csv.upload(ev.target.closest("form"),ev.target.files?.[0]);}catch(e){alertText(e.message,true);}
     ev.target.value="";
   }
 });
 const observer=new MutationObserver(mount);
 observer.observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener("DOMContentLoaded",mount);
 mount();
})();
