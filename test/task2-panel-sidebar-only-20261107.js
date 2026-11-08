/* Issue #47 integrated staging UI; canonical place: Исполнение перевозок. */
/* CONTAINER-STYLE-02: match the PТО input style; scoped against global dark-input rules. */
(function(){
 "use strict";
 const uploadIds=new WeakMap();
 const pendingRequests=new Map();
 const eid="task2-root";
 const canonicalNavigation=()=>{if(location.hash==="#shipment-fulfillment")location.replace("#approved-shipments");};
 window.addEventListener("hashchange",canonicalNavigation);canonicalNavigation();
 const state={items:[],role:"",selected:"",detail:null,tab:"stages",busy:false,notice:"",extraTrackingRows:0};
 const docTypes=["Инвойс","Упаковочный лист","CMR","СМГС / ЦИМ-СМГС","Коносамент B/L","AWB","Экспортная декларация","Транзитная декларация","Сертификат","Фото погрузки","Страховой полис","Инструкция","MSDS / UN38.3","Другое"];
 const tabs=[["overview","1. Общая информация"],["track","2. Трекинг"],["documents","3. Документы"],["stages","Этапы перевозки"],["completion","Завершение"],["history","История"]];
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
 const fmt=s=>{
   if(s===null||s===undefined||s==="")return "—";
   const raw=String(s).trim();
   const ru=raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[,\s]+(\d{2}):(\d{2}))?/);
   if(ru)return ru[1]+"."+ru[2]+"."+ru[3]+(ru[4]?", "+ru[4]+":"+ru[5]:"");
   const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
   if(iso&&!/[zZ]|[+-]\d{2}:\d{2}$/.test(raw))return iso[3]+"."+iso[2]+"."+iso[1]+(iso[4]?", "+iso[4]+":"+iso[5]:"");
   const d=new Date(raw);
   if(!Number.isNaN(d.getTime()))return d.toLocaleString("ru-RU",{timeZone:"Europe/Minsk"});
   return "Дата не распознана";
 };
 const minskISO=value=>{if(!value)throw Error("Укажите дату и время Минска");const str=String(value);const normalized=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)?str+":00+03:00":str;const d=new Date(normalized);if(Number.isNaN(d.getTime()))throw Error("Некорректная дата/время");return d.toISOString();};
 const badge=s=>'<span class="t2-badge">'+esc(s||"—")+"</span>";
 const field=(name,label,type,tip,extra="")=>'<label class="t2-field"><span>'+esc(label)+' <span class="t2-help" title="'+esc(tip||tips[name]||label)+'" aria-label="Подсказка: '+esc(label)+'">?</span></span>'+
   (type==="textarea"?'<textarea rows="3" name="'+esc(name)+'" '+extra+'></textarea>':
    type==="select"?'<select name="'+esc(name)+'" '+extra+'><option value="">Выберите…</option>'+docTypes.map(x=>'<option>'+esc(x)+'</option>').join("")+'</select>':
    '<input name="'+esc(name)+'" type="'+(type||"text")+'" '+extra+'>')+
   '<small>'+esc(tip||tips[name]||"")+'</small></label>';
 const readonly=(label,val)=>'<div class="t2-readonly"><small>'+esc(label)+'</small><strong>'+esc(val??"—")+'</strong></div>';
 const form=(kind,body,button="Сохранить изменения",hidden=false)=>
  '<form data-t2-form="'+kind+'" class="t2-form"><div class="t2-fields">'+body+'</div>'+(kind==="request_docs"?"":'<div class="t2-csv"><button type="button" class="t2-btn ghost" data-t2-csv-download>Скачать CSV шаблон</button><label class="t2-btn ghost">Загрузить CSV<input data-t2-csv-upload type="file" accept=".csv,text/csv" hidden></label><span class="t2-csv-info"></span></div>')+
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
   const heading='<header class="t2-heading"><div><h2>'+(state.role==="ved"?"Активные перевозки":"Исполнение перевозок")+'</h2><p>Этапы перевозки, документы, трекинг, прибытие и завершение. Работа начинается после принятия выбранной заявки перевозчиком.</p></div><button data-t2-refresh class="t2-btn ghost" type="button">Обновить</button></header>';
   // No secondary menu: the cabinet's left navigation is the only navigation.
   let html=heading+'<div id="t2-alert" class="t2-alert">'+esc(state.notice)+'</div>';
   if(!state.items.length){
     root.innerHTML=html+'<div class="t2-empty"><h3>Нет перевозок на этапе исполнения</h3><p>После выбора победителя и нажатия «Взять в работу» здесь появятся этапы перевозки.</p></div>';
     return;
   }
   const workflowLabel=i=>i.process_status==="completed"?"Завершена":i.process_status==="awaiting_take"?"Ожидает принятия":"В работе";
   html+='<div class="t2-picker"><label>Перевозка <select id="t2-select">'+state.items.map(i=>'<option value="'+esc(i.order_code)+'" '+(state.selected===i.order_code?"selected":"")+'>'+
    esc((stagingReg(i.registration_no)||"TEST-TR —")+" · "+i.order_code+" · "+workflowLabel(i))+'</option>').join("")+'</select></label></div>';
   if(!d){root.innerHTML=html+'<p>Открываем данные заявки…</p>';return;}
   const o=d.shipment,x=d.state||{},carrier=d.role==="carrier",staff=!carrier,started=!!d.state;
   if(state.role==="ved" && (!started || x.status==="awaiting_take")){
     root.innerHTML=heading+'<div class="t2-empty"><h3>Нет активных перевозок</h3><p>Перевозка появится после подтверждённого принятия победителем.</p></div>';
     return;
   }
   if(d.role==="carrier"&&d.state&&d.state.status!=="completed"){
     const sources=[d.shipment,d.offer,d.selected_offer,d.winning_offer,d.winner_offer,d.selectedOffer,d.winningOffer,d.rate,d.bid,d.proposal,d.selected_bid,d.winner,d];
     const keys=["delivery_days","transit_days","eta_days","delivery_term_days","duration_days","delivery_time_days","lead_time_days","transit_time_days","delivery_term","delivery_time","transit_time","duration","days","deliveryDays","transitDays"];
     let days=NaN;
     for(const source of sources){if(!source||typeof source!=="object")continue;for(const key of keys){const v=source[key],n=typeof v==="number"?v:parseInt(String(v??"").trim(),10);if(Number.isFinite(n)&&n>0&&n<=3650){days=n;break;}}if(Number.isFinite(days))break;}
     const total=Number.isFinite(days)?Math.ceil(days/7):0;
     const completed=(d.points||[]).filter(p=>p.location_text&&p.observed_at).length;
     const start=new Date(d.state.actual_departure||d.state.original_departure||d.shipment.pickup||"");
     const deadline=Number.isFinite(start.getTime())?new Date(start.getTime()+7*(completed+1)*86400000):null;
     const overdue=deadline&&Date.now()>deadline.getTime();
     const remaining=Math.max(0,total-completed);
     if(remaining>0)html+='<div role="status" style="padding:12px 16px;margin:12px 0;border:1px solid #d5a544;border-left:4px solid #d5a544;border-radius:9px;background:#fff8e9;color:#533d13"><strong>'+(overdue?'Просрочен еженедельный трекинг':'Требуется обновить местоположение груза')+'</strong><p style="margin:6px 0;color:inherit">Заполнено '+completed+' из '+total+'. '+(deadline?'Следующий срок: '+fmt(deadline.toISOString())+'. ':'')+'Осталось '+remaining+'.</p><button type="button" class="t2-btn" data-t2-tab="track">Заполнить трекинг</button></div>';
     else if(!total)html+='<div role="status" style="padding:12px;margin:12px 0;border:1px solid #d5a544;border-radius:9px;background:#fff8e9;color:#533d13"><strong>Срок доставки не указан</strong><p>Уточните срок утверждённой ставки для еженедельного графика.</p></div>';
   }
   html+='<div class="t2-context">'+readonly("Рег. №",stagingReg(o.registration_no)||"не присвоен")+readonly("Заказ",o.order_code)+readonly("№ Bitrix — все связанные",o.bitrix_task||"—")+
     readonly("Выбранный перевозчик",o.carrier_login)+
     readonly("Статус исполнения",x.status==="completed"?"Завершено":!started?"Ожидает принятия":"В работе")+'</div>';
   if(!started){
     html+='<div class="t2-empty"><h3>Ожидается принятие перевозки</h3><p>Выбранный перевозчик должен сначала нажать «Взять в работу» в разделе «Мои заявки».</p>'+(carrier?'<a class="t2-btn" href="#carrier-orders">Перейти в «Мои заявки»</a>':'Ожидается действие победившего перевозчика.')+'</div>';
   }else{
     html+='<div class="t2-process-banner"><div><strong>Перевозка принята в работу.</strong><span>Доступны этапы, трекинг, документы, сообщения и закрытие перевозки.</span></div></div>';
     const savedTab=state.tab;
     html+=tabs.filter(([key])=>key!=="completion"||!["ved","logistic"].includes(state.role)).map(([key,title])=>{
       state.tab=key;
       return '<section class="t2-stage" data-t2-section="'+esc(key)+'"><h3>'+esc(title)+'</h3>'+renderTab(d,carrier,staff)+'</section>';
     }).join("");
     state.tab=savedTab;
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
     let html='<h3>Документы исполнения перевозки</h3><p class="t2-muted">Здесь находятся сопроводительные файлы, запросы ВЭД и переписка во время перевозки.</p><div class="t2-stack">'+(d.docs||[]).map(f=>'<div class="t2-item"><span>'+esc(f.name)+' <small>'+esc(f.category)+'</small></span><button class="t2-btn ghost" data-t2-doc="'+esc(f.id)+'">Скачать</button></div>').join("")+'</div>';
     html+='<h3>Документы и задачи ВЭД</h3><p class="t2-muted">Проверка комплекта документов по поставке автоматически создаётся один раз при подтверждённом остатке маршрута менее 1000 км. Проверка выполняется до прибытия на ПТО.</p><div class="t2-stack">'+tasks.filter(t=>["pto_review","missing_documents","transport_documents","container_number"].includes(t.task_type)).map(taskCard).join("")+'</div>';
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
   if(state.tab==="stages"){
     const latestPoint=pts.length?pts[pts.length-1]:null;
     const milestones=[
       ["1","Заявка принята в работу",true,"После выбора победителя и принятия перевозчиком начинается исполнение"],
       ["2","Фактический выход груза",!!x.actual_departure,x.actual_departure?fmt(x.actual_departure):"Ожидается отметка перевозчика"],
       ["3","Движение груза",pts.length>0,latestPoint?esc(latestPoint.location_text)+" · "+fmt(latestPoint.observed_at):"Ожидается первая контрольная точка"],
       ["4","Прибытие на ПТО",!!x.pto_at,x.pto_at?fmt(x.pto_at):"Не зафиксировано"],
       ["5","Проверка документов ВЭД",!!x.pto_checked_at,x.pto_checked_at?fmt(x.pto_checked_at):"Ожидается проверка"],
       ["6","Таможенное оформление",!!x.customs_at,x.customs_at?fmt(x.customs_at):"Не завершено"],
       ["7","Приёмка на складе",!!x.warehouse_at,x.warehouse_at?fmt(x.warehouse_at):"Не подтверждена"],
       ["8","Закрытие перевозки",x.status==="completed",x.status==="completed"?"Перевозка закрыта":"Ожидает проверки и решения Владельца/ВЭД"]
     ];
     return '<h3>Этапы перевозки</h3><p class="t2-muted">Это фактические этапы исполнения, а не статусы согласования транспортного документа. События подтверждаются сохранёнными отметками и не заполняются автоматически.</p>'+
       '<div class="t2-milestones">'+milestones.map(([n,label,done,detail])=>
         '<div class="t2-milestone '+(done?"is-done":"is-pending")+'"><span class="t2-milestone-number">'+n+'</span><div><strong>'+esc(label)+'</strong><p>'+detail+'</p></div><span class="t2-milestone-status">'+(done?"Зафиксировано":"Ожидается")+'</span></div>'
       ).join("")+'</div>'+
       '<p><button type="button" class="t2-btn" data-t2-tab="track">Перейти к трекингу</button>'+(state.role==="owner"?' <button type="button" class="t2-btn ghost" data-t2-tab="completion">Проверить завершение</button>':'')+'</p>';
   }
   if(state.tab==="track"){
     const sourceDate=x.original_departure||o.pickup||"—";
     let html='<div class="t2-facts">'+readonly("Исходная плановая дата (заблокирована)",sourceDate)+readonly("Фактическая дата выхода",fmt(x.actual_departure))+
       readonly("ПТО",fmt(x.pto_at))+readonly("Дата завершения таможенного оформления",fmt(x.customs_at))+readonly("Дата приёмки груза на складе",fmt(x.warehouse_at))+
       readonly("Общая длина маршрута, км",d.route?.total_km??"не рассчитано")+readonly("Осталось по маршруту, км",d.route?.remaining_km??"не рассчитано")+'</div>';
     if(carrier&&x.status!=="completed"){
       html+='<h3>Обновление перевозки</h3><p class="t2-muted">Заполняйте только то, что изменилось. Пустые необязательные поля можно оставить без изменений. Сохранение не завершает перевозку.</p>';
       html+='<div class="t2-block-title">1. Отправление · даты и переносы</div>'+
         '<div class="t2-plans-current"><strong>Исходная плановая дата: '+fmt(x.original_departure||o.pickup)+'</strong><span>Максимум 4 переноса</span></div>'+
         '<div class="t2-plan-four">'+Array.from({length:4},(_,i)=>{
           const p=plans[i],allowed=i===plans.length&&plans.length<4&&!x.actual_departure;
           if(p)return '<div class="t2-plan-four-row is-saved"><span>Перенос '+(i+1)+'</span><strong>'+fmt(p.planned_departure)+'</strong><span>'+esc(p.reason||"Причина не указана")+'</span><span class="t2-plan-saved">Сохранено</span></div>';
           if(!allowed)return '<div class="t2-plan-four-row is-locked"><span>Перенос '+(i+1)+'</span><span>—</span><span>—</span><span>'+(x.actual_departure?'Недоступно после отправления':'Ожидает предыдущий перенос')+'</span></div>';
           return '<form data-t2-form="plan" class="t2-plan-four-row"><span>Перенос '+(i+1)+'</span><label><span>Новая дата (Минск)</span><input type="datetime-local" name="new_plan_date" required></label><label><span>Причина</span><input type="text" name="new_plan_reason" required maxlength="500" placeholder="Причина переноса"></label><button class="t2-btn" type="submit">Сохранить</button><div class="t2-plan-feedback" role="status" aria-live="polite"></div></form>';
         }).join("")+'</div>';
       html+='<div class="t2-actual-row" style="display:grid;grid-template-columns:90px minmax(0,1fr);align-items:center;gap:10px;border:1px solid #c8d7e7;border-radius:9px;background:#eef5fd;padding:9px 12px;margin:10px 0 18px">'+
        '<span class="t2-actual-label">Фактическое отправление</span>'+
        (x.actual_departure?'<strong class="t2-actual-saved">'+fmt(x.actual_departure)+'</strong><span class="t2-actual-note">Дата зафиксирована</span><span class="t2-plan-saved">Сохранено</span>':
         '<form data-t2-form="actual" class="t2-actual-form" style="display:grid!important;grid-template-columns:minmax(220px,1fr) minmax(140px,1fr) 116px;align-items:center;gap:10px;width:100%;margin:0"><label style="display:flex;flex-direction:column;gap:3px;min-width:0;margin:0"><span>Фактическая дата (Минск)</span><input type="datetime-local" name="actual_departure" required style="width:100%;min-width:0;box-sizing:border-box;height:40px;background:#fff;color:#173650;border:1px solid #9fb1c6;border-radius:7px;padding:6px 9px"></label><span class="t2-actual-note">Указывается один раз</span><button class="t2-btn" type="submit" style="height:40px;margin:0">Сохранить</button><div class="t2-plan-feedback" role="status" aria-live="polite"></div></form>')+
         '</div>';
       html+='<div class="t2-block-title">2. Еженедельный трекинг груза</div>'+

         '<div class="t2-weekly-tracking">'+
         (()=>{const sources=[o,d.offer,d.selected_offer,d.winning_offer,d.winner_offer,d.selectedOffer,d.winningOffer,d.rate,d.bid,d.proposal,d.selected_bid,d.winner,d];
           const keys=["delivery_days","transit_days","eta_days","delivery_term_days","duration_days","delivery_time_days","lead_time_days","transit_time_days","delivery_term","delivery_time","transit_time","duration","days","deliveryDays","transitDays"];
           const parseDays=v=>{if(typeof v==="number")return v;if(typeof v==="string"){const m=v.trim().match(/^(\\d{1,4})(?:\\s*(?:дн(?:ей|я|ь)?|days?|сут(?:ок|ки)?))?$/i);return m?Number(m[1]):NaN;}return NaN;};
           let raw;
           for(const source of sources){if(!source||typeof source!=="object")continue;for(const key of keys){const v=source[key];if(Number.isFinite(parseDays(v))&&parseDays(v)>0){raw=v;break;}}if(raw!==undefined)break;}
           if(raw===undefined){for(const source of sources){if(!source||typeof source!=="object")continue;for(const [key,v] of Object.entries(source)){if(/(?:delivery|transit|eta|duration|срок).*(?:day|дн|time|term)|(?:day|дн).*(?:delivery|transit)/i.test(key)&&Number.isFinite(parseDays(v))&&parseDays(v)>0){raw=v;break;}}if(raw!==undefined)break;}}
           
           const days=parseDays(raw),valid=Number.isFinite(days)&&days>0&&days<=3650;
           const planned=valid?Math.ceil(days/7):0;
           const count=Math.max(planned,pts.length+1)+state.extraTrackingRows;
           return '<p class="t2-muted">'+(valid?'Плановый срок: '+days+' дн. · Контрольных недель: '+planned:'Срок доставки в днях не указан. Уточните срок в предложении перевозчика для автоматического графика.')+
             '. Каждая запись: местонахождение и дата. Остаток км рассчитывается по подтверждённому маршруту.</p>'+
             Array.from({length:Math.min(count,525)},(_,i)=>{const p=pts[i];
               return p?'<div class="t2-weekly-row is-saved"><strong>Неделя '+(i+1)+'</strong><span>'+esc(p.location_text||"—")+'</span><span>'+fmt(p.observed_at)+'</span><span>Осталось км: '+esc(p.remaining_km??"не рассчитано")+'</span></div>':
               i===pts.length?'<form data-t2-form="weekly-point" class="t2-weekly-row"><strong>Неделя '+(i+1)+'</strong><label><span>Место</span><input name="location" required placeholder="Город, станция или порт"></label><label><span>Дата (Минск)</span><input name="location_date" type="datetime-local" required></label><button class="t2-btn" type="submit">Сохранить</button></form>':
               '<div class="t2-weekly-row is-pending"><strong>Неделя '+(i+1)+'</strong><span>—</span><span>—</span><span>Ожидает предыдущую запись</span></div>';
             }).join('')+
             '<button type="button" class="t2-btn ghost" data-t2-action="extra-weekly-point">+ Добавить контрольную точку при задержке</button>';
         })()+'</div>';
       html+='<div class="t2-block-title">3. ПТО / таможенное оформление</div>'+
         '<form data-t2-form="save" class="t2-pto-compact" style="display:grid!important;grid-template-columns:minmax(140px,.7fr) minmax(190px,1fr) minmax(190px,1fr) 116px;gap:10px;align-items:start;width:100%;margin:0 0 14px">'+
         (x.pto_at?'<div class="t2-pto-cell"><small>Прибытие на ПТО</small><strong>Да</strong></div>':
           '<label class="t2-pto-cell"><span>Прибыл на ПТО?</span><select name="pto_yes"><option value="">Нет</option><option value="yes">Да</option></select></label>')+
         (x.pto_at?'<div class="t2-pto-cell"><small>Дата прибытия</small><strong>'+fmt(x.pto_at)+'</strong></div>':
           '<label class="t2-pto-cell"><span>Дата прибытия (Минск)</span><input type="datetime-local" name="pto_date"></label>')+
         (x.customs_at?'<div class="t2-pto-cell"><small>Таможенное оформление завершено</small><strong>'+fmt(x.customs_at)+'</strong></div>':
           '<label class="t2-pto-cell" title="Дата завершения импортного таможенного оформления (Минск)"><span>Завершение таможни (Минск)</span><input type="datetime-local" name="customs_date"></label>')+
         '<button type="submit" class="t2-btn" style="width:116px;height:38px;min-height:38px;align-self:start;margin-top:22px">Сохранить</button></form>'+
         '<p class="t2-muted">Проверка документов ВЭД проводится до прибытия на ПТО. Даты сохраняются независимо от номера контейнера.</p>'+
         '<div class="t2-block-title">4. Номер контейнера</div>'+
         '<form data-t2-form="container" class="t2-container-compact" style="display:grid!important;grid-template-columns:minmax(0,1fr) 116px;gap:10px;align-items:start;width:100%;margin:0 0 14px">'+
         '<label class="t2-pto-cell" style="min-width:0"><span>№ контейнера (необязательно)</span><input type="text" name="container_no" maxlength="50" placeholder="Введите номер контейнера" required style="width:100%;height:38px;min-width:0;box-sizing:border-box;background:#fff!important;color:#17243a!important;border:1px solid #cbd5e1!important;border-radius:8px!important;padding:0 12px!important;box-shadow:none!important;appearance:none!important;-webkit-text-fill-color:#17243a!important"></label>'+
         '<button type="submit" class="t2-btn" style="width:116px;height:38px;margin:22px 0 0;align-self:start">Сохранить</button></form>';
        // Склад — фактическое событие перевозчика после таможни, а НЕ новая задача ВЭД.
        if(x.customs_at&&!x.warehouse_at){
          html+='<div class="t2-block-title">5. Прибытие груза на склад</div>'+
            '<form data-t2-form="save" class="t2-container-compact" style="display:grid!important;grid-template-columns:minmax(0,1fr) 116px;gap:10px;align-items:start;width:100%;margin:0 0 14px">'+
            '<label class="t2-pto-cell"><span>Фактическая дата прибытия (Минск)</span><input type="datetime-local" name="warehouse_date" required></label>'+
            '<button type="submit" class="t2-btn" style="width:116px;height:38px;margin:22px 0 0;align-self:start">Сохранить</button></form>';
        }else if(x.warehouse_at)html+='<div class="t2-block-title">5. Прибытие груза на склад</div>'+readonly("Прибытие подтверждено",fmt(x.warehouse_at));
     }
     /* History of dates is shown directly above the new transfer fields. */
     html+='<h3>Контейнеры</h3><div class="t2-stack">'+(cs.length?cs.map(c=>readonly("№",c.container_no)).join(""):'<p class="t2-muted">Номер не указан; продолжение работы разрешено.</p>')+'</div>';
     html+='<h3>Движение груза</h3><div class="t2-stack">'+(pts.length?pts.map(p=>'<div class="t2-item"><div><strong>'+esc(p.location_text)+'</strong><br><small>'+fmt(p.observed_at)+' · '+esc(p.comment||"")+'</small></div><small>Осталось км: '+esc(p.remaining_km??"не рассчитано")+'</small></div>').join(""):'<p class="t2-muted">Контрольных точек пока нет.</p>')+'</div>';
     if(pts.length){
       const place=pts[pts.length-1].location_text;
       html+='<h3>Карта местоположения</h3><iframe class="t2-map" loading="lazy" title="Карта груза" src="https://yandex.ru/map-widget/v1/?text='+encodeURIComponent(place)+'"></iframe><p><a target="_blank" rel="noopener noreferrer" href="https://yandex.ru/maps/?text='+encodeURIComponent(place)+'">Открыть карту</a></p>';
     }
     html+='<p class="t2-muted">Автоматические километры рассчитываются только при наличии подтверждённого маршрута. Для недоступных режимов показано «не рассчитано» без фиктивного значения.</p>';
     return html;
   }
   if(state.tab==="completion"||state.tab==="arrival"){
     let html='<h3>Завершение перевозки</h3><div class="t2-facts">'+readonly("ПТО",fmt(x.pto_at))+readonly("Проверка ВЭД",fmt(x.pto_checked_at))+readonly("Дата завершения таможенного оформления",fmt(x.customs_at))+readonly("Дата приёмки груза на складе",fmt(x.warehouse_at))+'</div>';
     html+='<p class="t2-muted">Перевозчик регистрирует фактические события во вкладке «Трекинг». Здесь ВЭД и Владелец проверяют обязательные этапы и принимают решение о закрытии перевозки.</p>';
     // ВЭД выполняет единственную автоматическую задачу проверки документов во вкладке «Документы»; дополнительных задач при закрытии нет.
     if(state.role==="owner"&&x.status!=="completed"){
       html+='<p>Владелец проверяет фактические события и завершает перевозку. Это не создаёт задач ВЭД.</p>';
       html+='<button class="t2-btn" type="button" data-t2-action="finish">Проверить и завершить</button>';
       
     }
     return html;
   }
   if(false && state.tab==="claims"){
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
   const active=t.status!=="completed"&&t.status!=="cancelled",staff=["owner","logistic","ved"].includes(state.role);
   return '<article class="t2-item"><div><strong>'+esc(t.task_type)+'</strong> '+badge(t.status)+'<p>'+esc(t.description)+'</p><small>№ Bitrix: '+esc(t.inherited_bitrix_tasks||"—")+'</small></div>'+
      (staff&&active?'<button type="button" class="t2-btn" data-t2-task-complete="'+esc(t.id)+'" data-kind="'+esc(t.task_type)+'">Завершить задачу ВЭД</button>':"")+'</article>';
 }
 async function loadList(){
   const list=await get("");
   state.role=(document.querySelector('.cabinet-role')?.textContent||'').includes('ВЭД')?'ved':list.role;
   const incoming=list.items||[];
   if(state.role==="ved"){
     // Defense in depth: VED must not display shipments pending carrier acceptance.
     // The backend MUST enforce the same rule for list, detail and file endpoints.
     const accepted=incoming.filter(item=>item.process_status!=="awaiting_take" &&
       ["in_progress","active","completed","accepted"].includes(String(item.process_status||"").toLowerCase()));
     const checked=[];
     for(const item of accepted){
       try{
         const detail=await get("?order="+encodeURIComponent(item.order_code));
         if(detail?.state && detail?.shipment?.carrier_login && detail.state.status!=="awaiting_take")checked.push(item);
       }catch(_){/* inaccessible: do not display */ }
     }
     state.items=checked;
   }else state.items=incoming;
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
   if(kind==="weekly-point"){
     if(!String(data.location||"").trim()||!data.location_date){alertText("Укажите местонахождение и дату.",true);return;}
     const button=f.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent="Сохраняем…";}
     try{await update("save",{fields:{location:String(data.location).trim(),location_date:minskISO(data.location_date)}});}
     finally{if(button?.isConnected){button.disabled=false;button.textContent="Сохранить";}}
     return;
   }
   if(kind==="actual"){
     if(state.detail?.state?.actual_departure){alertText("Фактическая дата уже зафиксирована. Повторное сохранение запрещено.",true);return;}
     if(!data.actual_departure){alertText("Укажите фактическую дату отправления.",true);return;}
     const btn=f.querySelector('button[type="submit"]'),feedback=f.querySelector('.t2-plan-feedback');
     if(btn){btn.disabled=true;btn.textContent="Сохраняем…";}
     if(feedback)feedback.textContent="Проверяем сохранение…";
     try{
       const result=await update("save",{fields:{actual_departure:minskISO(data.actual_departure)}});
       if(!result?.ok){if(feedback)feedback.textContent="Ошибка сохранения. Дата не подтверждена.";return;}
       await loadDetail();
       const stored=state.detail?.state?.actual_departure;
       if(!stored){alertText("Сервер не подтвердил фактическую дату. Повторно проверьте запись.",true);}
       else alertText("Фактическая дата отправления сохранена.");
     }finally{if(btn?.isConnected){btn.disabled=false;btn.textContent="Сохранить";}}
     return;
   }
   if(kind==="plan"){
     if((state.detail?.plans||[]).length>=4){alertText("Достигнут предел: четыре переноса",true);return;}
     if(!data.new_plan_date||!String(data.new_plan_reason||"").trim()){alertText("Укажите новую дату и причину",true);return;}
     const button=f.querySelector('button[type="submit"]'),feedback=f.querySelector('.t2-plan-feedback');
     if(button){button.disabled=true;button.textContent="Сохраняем…";}
     if(feedback)feedback.textContent="Проверяем сохранение…";
     const before=(state.detail?.plans||[]).length;
     try{
       const result=await update("save",{fields:{new_plan_date:minskISO(data.new_plan_date),new_plan_reason:String(data.new_plan_reason).trim()}});
       if(!result?.ok){if(feedback)feedback.textContent="Не удалось сохранить. Проверьте сообщение об ошибке.";return;}
       await loadDetail();
       const after=(state.detail?.plans||[]).length;
       if(after<=before){alertText("Сервер не подтвердил добавление переноса. Данные не считаются сохранёнными.",true);}
       else alertText("Перенос № "+after+" сохранён. Следующая строка доступна.");
     }finally{if(button?.isConnected){button.disabled=false;button.textContent="Сохранить";}}
     return;
   }
   if(kind==="container"){
     const value=String(data.container_no||"").trim();
     if(!value){alertText("Введите номер контейнера",true);return;}
     const button=f.querySelector('button[type="submit"]');
     if(button){button.disabled=true;button.textContent="Сохраняем…";}
     try{
       const result=await update("save",{fields:{container_no:value}});
       if(!result?.ok)return;
       const found=(state.detail?.containers||[]).some(c=>String(c.container_no||"").trim()===value);
       if(found)alertText("Номер контейнера сохранён: "+value);
       else alertText("Сервер ответил, но номер контейнера не найден в обновлённых данных. Проверьте сохранение.",true);
     }finally{if(button?.isConnected){button.disabled=false;button.textContent="Сохранить";}}
     return;
   }
   if(kind==="save"){
     const fields={};
     for(const [key,value] of Object.entries(data)){
       if(value===""||key==="__method")continue;
       if(key==="pto_yes"){fields.pto_yes=value==="yes";continue;}
       fields[key]=["new_plan_date","actual_departure","location_date","pto_date","customs_date","warehouse_date"].includes(key)?minskISO(value):value;
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
     location.hash="#transport-applications";return;
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
   if(hit.dataset.t2Action==="extra-weekly-point"){state.extraTrackingRows++;show();return;}
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
 window.addEventListener("carrier-flow-open-execution",async event=>{
   const order=String(event.detail?.order||"");
   if(!order)return;
   try{
     if(!state.items.some(item=>item.order_code===order))await loadList();
     if(!state.items.some(item=>item.order_code===order))return;
     state.selected=order;
     await loadDetail();
   }catch(error){alertText(error.message||"Не удалось открыть выбранную перевозку",true);}
 });
 document.addEventListener("DOMContentLoaded",mount);
 mount();
})();
