/* Task #2: field-level instructions, FAQ and CSV import for long existing forms. */
(function(){
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const hints=[
[/битрикс|bitrix/i,"Введите все связанные номера задач Bitrix (до 20). Они автоматически перейдут в каждый связанный кабинет и документы; не заменяются регистрационным номером."],
[/номер заказа|order.?code|подстановк/i,"Номер заказа компании, например C26EM080961. Это не регистрационный номер TR; сохраняется в дочерних задачах."],
[/контакт отправител/i,"Имя, телефон, email или WeChat сотрудника фабрики/склада; необязателен, перевозчик увидит его после получения заявки."],
[/пункт погруз|origin/i,"Страна, город и фактический адрес фабрики/склада. Маршрут и расстояние по возможности рассчитываются из подтверждённых адресов."],
[/конечн.*(пункт|точк)|destination/i,"Конечная точка поставки: конкретный склад или терминал, например Минск, Колядичи."],
[/промежуточн|waypoint/i,"Промежуточные терминалы, станции, порты и переходы; каждую точку указывайте отдельно по порядку движения."],
[/инкотермс|incoterm/i,"Выберите применимое условие Incoterms 2020 и обязательно уточните именованное место/порт в договоре."],
[/дата готовност|readiness|ready.?date/i,"Плановая дата готовности груза у поставщика; не путайте с фактическим выходом или растаможкой."],
[/дедлайн|ставки принимаются до/i,"Время окончания обычной подачи ставок по часовому поясу Минска. Просроченные предложения до выбора победителя рассматриваются отдельно."],
[/опасн|dangerous/i,"Укажите «Да», «Нет» или «Неизвестно». При опасном грузе приложите соответствующие паспорта, сведения о классе и разрешения, если применимы."],
[/объ.?м|volume/i,"Общий объём груза в кубических метрах, например 8,45 м³."],
[/вес брутто|gross weight|weight/i,"Вес всей партии с упаковкой в килограммах; не путать с весом нетто одной единицы."],
[/номер контейнер|container/i,"Номер контейнера необязателен в пути. При закрытии без него ВЭД/Владелец решает: закрыть либо запросить номер перевозчику."],
[/фактическ.*выход|actual.depart/i,"Дата действительного отправления; после фиксации новые плановые переносы запрещены."],
[/планов.*выход|planned.depart|pickup/i,"Исходная плановая дата неизменяема. Для каждого переноса добавьте новую дату через «+» с обязательной причиной."],
[/местополож|location/i,"Отметка о текущем месте груза и дата/время сведений; каждая точка сохраняется в хронологии."],
[/сумма|amount|price|ставка/i,"В предложении укажите стоимость и валюту. После выбора победителя стоимость/валюта переносятся автоматически и не согласуются повторно."],
[/срок перевоз|transit|eta/i,"Плановая продолжительность и ожидаемая дата прибытия; это прогноз, а не фактическая дата."],
[/склад|warehouse/i,"ВЭД фиксирует фактическую дату приёмки заказчиком; она автоматически доступна перевозчику."],
[/документ|upload|file|вложени/i,"Выберите один или несколько файлов. Дождитесь подтверждения загрузки и проверьте список перед закрытием задания."],
[/причин|reason/i,"Опишите фактическую причину изменения, отказа или претензии; решение и дата остаются в журнале."],
[/претензи|claim/i,"Укажите событие, обстоятельства, доказательства, сумму требований и вид транспорта. Итоговый статус при претензии закрывают только ВЭД или Владелец."],
[/длина|ширина|высота|height|width|length/i,"Укажите размеры и единицы измерения (мм/см). При автоконвертации проверьте пересчитанное значение."],
[/валюта|currency/i,"Выберите валюту предложения. После выбора победителя менять её в исполнении нельзя."],
[/маршрут|route/i,"Последовательность пунктов, станций/портов и пересечений границы. Не путайте маршрут перевозки с адресом фабрики."],
[/водитель|driver/i,"ФИО водителя и реквизиты автомобиля для авто; не показывать эти поля в форме ЖД, авиа или моря."],
[/плиты|rohs|emc|msds/i,"Приложите действующий документ на конкретный товар; отметьте причину, если документа пока нет."],
[/чат|message|комментар/i,"Пояснение, сохраняемое в контексте конкретной задачи, доступно участникам по уровню доступа."]
];
const general="Наведите на подсказку для формата и примера. Изменение сохранится только после штатной кнопки «Сохранить»; пустые значения не должны стирать уже заполненные.";
const helpQuestions=[
["Как связаны заявки и процесс исполнения?","Владелец публикует запрос → перевозчики подают ставки → Владелец выбирает одного победителя → только победитель нажимает «Взять перевозку в работу» → документы, трекинг, ПТО, растаможка, склад → итог ВЭД/Владельца."],
["Чем «Согласовать участие» отличается от выбора победителя?","Согласование участия означает допуск ставки к рассмотрению. Оно не означает принятие цены. Выбирается только один победитель; проигравшие не могут брать заказ к исполнению."],
["Зачем TR-26-000001, если есть номер заказа и Bitrix?","TR — уникальный номер заявки по годам, начиная с 000001 1 января каждого года по времени Минска. Заказ и все номера Bitrix остаются отдельными реквизитами и наследуются каждым связанным поручением."],
["Что происходит по дедлайну?","Ответы вовремя допускаются к рассмотрению. До выбора победителя возможны просроченные ставки, которые помечаются отдельно; решение учитывать их принимает Владелец. Штраф SL за отсутствие своевременного ответа не снимается."],
["Какие действия доступны после «Взять перевозку в работу»?","Запрос документов ВЭД (сколько угодно раз), получение и загрузка файлов, транспортная заявка, добавление переноса плановой даты, фактического выхода и местонахождения, ПТО, растаможка и приемка."],
["Как работают запросы документов ВЭД?","Перевозчик выбирает виды документов и пишет описание. Каждый запрос создаёт новую задачу ВЭД. Документы можно загружать много раз, они видны в задаче и общем чате Владельца, ВЭД и выбранного перевозчика."],
["Почему нельзя изменить первоначальную дату выхода?","Она перенесена из утверждённой ставки. Каждая новая плановая дата добавляется через «+» с причиной; предыдущая история не стирается. После фактического выхода новые переносы плановой даты недоступны."],
["Как работает трекинг и карта?","Перевозчик добавляет отдельные контрольные точки с датой/временем; карта показывает актуальную точку. Километры рассчитываются только при доступности корректного маршрутного сервиса: нельзя подменять маршрутом по прямой."],
["Что происходит после прибытия на ПТО?","Отметка «Да» однократно создаёт поручение ВЭД проверить документы. После проверки ВЭД завершает именно своё поручение, а у связанного поставщика фиксируется отметка «Проверено ВЭД»."],
["Как фиксируются растаможка и склад?","Перевозчик вводит фактическую дату растаможки → система однократно создаёт задачу ВЭД на приёмку → ВЭД фиксирует дату склада, которая видна перевозчику. Перевозка сама по себе не закрывается."],
["Обязательно ли указывать контейнер?","Во время перевозки нет. При попытке закрыть без номера ВЭД/Владелец выбирает: «Да — запросить» или «Нет — завершить без номера». При запросе перевозчик заполняет номер; чистая перевозка закроется автоматически, только если остальные этапы пройдены."],
["Как работает претензия?","Акт создаётся по типу транспорта (авто, ЖД, авиа, море), с доказательствами и версией; перевозчик согласует или отказывает с причиной. Любую перевозку, в истории которой была претензия, окончательно завершает только ВЭД или Владелец."],
["Как пользоваться CSV, если полей много?","Скачайте CSV из нужной формы, заполните доступные значения, загрузите файл, проверьте предварительное сопоставление и подтвердите перенос. Затем нажмите штатное сохранение формы. Исходные защищённые поля, ставки и номера TR не изменяются."],
["Почему нельзя выполнять одно действие в разных меню?","Для каждого действия установлен один раздел. Другие разделы должны давать ссылку на него, а не повторять его обработчик. Ставки — в рассмотрении, исполнение — в исполнении, транспортная заявка — в документе, претензия — в актах."]
];
let observerPending=false;
function guidance(){
 for(const label of document.querySelectorAll("label")){
   if(label.closest("#task2-root"))continue;
   const input=label.querySelector("input,textarea,select");
   if(!input||["hidden","password","submit","checkbox","radio","file"].includes(input.type))continue;
   const text=label.textContent.replace("ⓘ","").trim().slice(0,100);
   if(!text)continue;
   const title=hints.find(([re])=>re.test(text))?.[1]||general;
   input.title=title;
   const icon=label.querySelector(".t2-legacy-hint");if(icon)icon.title=title;
   else if(!label.dataset.task2Explained){
     const mark=document.createElement("span");mark.className="t2-legacy-hint";mark.title=title;mark.textContent=" ⓘ";label.append(mark);
   }
   label.dataset.task2Explained="1";
 }
}
function faq(){
 const host=document.querySelector('.cabinet-panel[data-section="help"]');
 if(!host||host.querySelector("#task2-faq"))return;
 const section=document.createElement("section");section.id="task2-faq";
 section.style.cssText="border:1px solid #d5e4d8;background:#fff;color:#173226;padding:16px;border-radius:12px;margin:18px 0";
 section.innerHTML='<h2 style="margin:0 0 10px;font-size:20px">Задача №2 · Полный бизнес-процесс перевозки</h2><p>Инструкция по полям доступна через значок ⓘ рядом с полем. Ниже ответы по работе всех кабинетов.</p>'+
 helpQuestions.map(([q,a])=>'<details style="border-top:1px solid #d9e4da;padding:10px 0"><summary style="font-weight:600;cursor:pointer">'+esc(q)+'</summary><p style="line-height:1.5">'+esc(a)+'</p></details>').join("");
 host.append(section);
}
function supplier(){
 if(window.freightAccess?.role!=="supplier")return;
 const host=document.querySelector('.cabinet-panel[data-section="supplier-orders"]');
 if(!host||host.querySelector("#task2-supplier-verified"))return;
 const wrapper=document.createElement("section");wrapper.id="task2-supplier-verified";wrapper.style.cssText="margin:12px 0;border:1px solid #dce6df;background:#fff;color:#263f32;border-radius:10px;padding:13px";
 wrapper.innerHTML="<h3>Проверка документов ВЭД</h3><p>Статус по связанным заказам…</p>";host.prepend(wrapper);
 fetch("/api/task2?supplier_checks=1").then(r=>r.ok?r.json():Promise.reject(Error("Данные проверки недоступны"))).then(d=>{
  wrapper.innerHTML="<h3>Проверка документов ВЭД</h3>"+(d.items||[]).map(x=>'<div style="padding:7px 0;border-top:1px solid #e4e9e5"><b>'+esc(x.order_code)+'</b> — '+(x.ved_checked_at?"Проверено ВЭД · "+esc(new Date(x.ved_checked_at).toLocaleString("ru-RU")):"Ожидает проверки ВЭД")+"</div>").join("");
 }).catch(e=>{wrapper.querySelector("p").textContent=e.message});
}
function controls(form){
 return Array.from(form.querySelectorAll("input[name],textarea[name],select[name]")).filter(el=>
    !["hidden","file","password","submit","button","radio","checkbox"].includes(el.type)&&!el.disabled&&!el.readOnly&&el.name.length<100&&!/^(?:registration_no|winner|selected_offer|price_approved|role)$/i.test(el.name));
}
function quoted(v){
 let s=String(v??"");
 if(/^[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function exportCSV(form){
 const fields=controls(form);
 const csv=fields.map(f=>quoted(f.name)).join(";")+"\r\n"+fields.map(f=>quoted(f.value)).join(";")+"\r\n";
 const u=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=u;a.download="freight-form-"+(form.id||"fields")+".csv";a.click();
 setTimeout(()=>URL.revokeObjectURL(u),8000);
}
function parseCSV(text){
 const row=[];let cells=[],value="",inQuotes=false,separator=(text.slice(0,500).match(/;/g)||[]).length>=(text.slice(0,500).match(/,/g)||[]).length?";":",";
 text=text.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(inQuotes&&text[i+1]==='"'){value+='"';i++}else inQuotes=!inQuotes;}
  else if(c===separator&&!inQuotes){cells.push(value);value="";}
  else if((c==="\r"||c==="\n")&&!inQuotes){if(c==="\r"&&text[i+1]==="\n")i++;cells.push(value);if(cells.some(Boolean))row.push(cells);cells=[];value="";}
  else value+=c;
 }
 cells.push(value);if(cells.some(Boolean))row.push(cells);
 if(inQuotes||row.length<2)throw Error("Неверный CSV: нет корректного заголовка и строки");
 return row;
}
function setReactValue(element,value){
 const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 const setter=Object.getOwnPropertyDescriptor(prototype,"value")?.set;
 if(setter)setter.call(element,value);else element.value=value;
 element.dispatchEvent(new Event("input",{bubbles:true}));
 element.dispatchEvent(new Event("change",{bubbles:true}));
}
async function importCSV(form,file){
 const rows=parseCSV(await file.text()),headers=rows[0],data=rows[1],fields=controls(form);
 if(rows.length!==2)throw Error("Один шаблон заполняет одну форму: используйте одну строку данных");
 const known=new Map(fields.map(f=>[f.name,f]));
 const changes=headers.map((key,i)=>({element:known.get(key),key,value:data[i]??""})).filter(x=>x.element&&x.value!=="");
 if(!changes.length)throw Error("Не найдено данных для полей формы (проверьте заголовки)");
 if(changes.some(x=>/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(x.value)&&/date/i.test(x.element.type)))throw Error("Неоднозначная дата: используйте YYYY-MM-DD");
 const preview=changes.map(x=>x.key+" : "+String(x.element.value||"—")+" → "+x.value).join("\n").slice(0,2400);
 if(!confirm("Найдено "+changes.length+" полей:\n"+preview+"\n\nПеренести значения в форму? Это НЕ отправит и НЕ закроет заявку."))return;
 for(const {element,value} of changes)setReactValue(element,value);
 alert("Перенесено значений: "+changes.length+". Проверьте форму и используйте её штатную кнопку сохранения.");
}
function legacyCSV(){
 for(const form of document.querySelectorAll("form")){
  if(form.closest("#task2-root")||form.dataset.task2Csv||form.closest(".auth-card")||form.querySelector('input[type="password"]'))continue;
  const input=controls(form);
  if(input.length<5||input.length>130)continue;
  form.dataset.task2Csv="1";
  const tools=document.createElement("div");tools.className="t2-legacy-csv";
  tools.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:9px 0";
  const download=document.createElement("button");download.type="button";download.className="btn secondary";download.textContent="Скачать CSV шаблон";download.addEventListener("click",()=>exportCSV(form));
  const label=document.createElement("label");label.className="btn secondary";label.style.cursor="pointer";label.textContent="Загрузить CSV";
  const upload=document.createElement("input");upload.type="file";upload.accept=".csv,text/csv";upload.hidden=true;label.append(upload);
  upload.addEventListener("change",async()=>{try{if(upload.files[0])await importCSV(form,upload.files[0])}catch(e){alert(e.message)}finally{upload.value=""}});
  tools.append(download,label);form.append(tools);
 }
}
function mount(){
 if(observerPending)return;observerPending=true;
 requestAnimationFrame(()=>{observerPending=false;guidance();faq();supplier();legacyCSV();});
}
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("freight-access-updated",mount);
document.addEventListener("DOMContentLoaded",mount);
mount();
})();
