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
["Как пользоваться Excel-шаблоном, если полей много?","Скачайте XLSX из нужной формы: каждое поле — отдельная колонка. Заполните строку значений в Microsoft Excel или WPS, затем загрузите XLSX, проверьте сопоставление и подтвердите перенос. Даты можно вводить как ДД.ММ.ГГГГ или YYYY-MM-DD, стоимость — с запятой или точкой. После загрузки нажмите штатную кнопку отправки; исходные защищённые поля и номер TR не изменяются."],
["Почему нельзя выполнять одно действие в разных меню?","Для каждого действия установлен один раздел. Другие разделы должны давать ссылку на него, а не повторять его обработчик. Ставки — в рассмотрении, исполнение — в исполнении, транспортная заявка — в документе, претензия — в актах."]
];
const helpLanguage=()=>/^zh/i.test(document.documentElement.lang)?"zh":/^en/i.test(document.documentElement.lang)?"en":"ru";
let observerPending=false;
function guidance(){
 for(const label of document.querySelectorAll("label")){
   if(label.closest("#task2-root"))continue;
   const input=label.querySelector("input,textarea,select");
   if(!input||["hidden","password","submit","checkbox","radio","file"].includes(input.type))continue;
   const text=label.textContent.replace("ⓘ","").trim().slice(0,100);
   if(!text)continue;
   const index=label.dataset.task2HintIndex===undefined?hints.findIndex(([re])=>re.test(text)):Number(label.dataset.task2HintIndex);
   label.dataset.task2HintIndex=String(index);
   const locale=window.task2HelpLocales?.[helpLanguage()];
   const title=locale?(locale.hints[index]||locale.general):(hints[index]?.[1]||general);
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
 if(!host)return;
 const language=helpLanguage(),existing=host.querySelector("#task2-faq");
 if(existing?.dataset.language===language)return;
 existing?.remove();
 const locale=window.task2HelpLocales?.[language];
 const section=document.createElement("section");section.id="task2-faq";section.dataset.language=language;
 section.style.cssText="border:1px solid #d5e4d8;background:#fff;color:#173226;padding:16px;border-radius:12px;margin:18px 0";
 section.innerHTML='<h2 style="margin:0 0 10px;font-size:20px">'+esc(locale?.title||"Задача №2 · Полный бизнес-процесс перевозки")+'</h2><p>'+esc(locale?.intro||"Инструкция по полям доступна через значок ⓘ рядом с полем. Ниже ответы по работе всех кабинетов.")+'</p>'+
 (locale?.faq||helpQuestions).map(([q,a])=>'<details style="border-top:1px solid #d9e4da;padding:10px 0"><summary style="font-weight:600;cursor:pointer">'+esc(q)+'</summary><p style="line-height:1.5">'+esc(a)+'</p></details>').join("");
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
    !["hidden","file","password","submit","button","radio","checkbox"].includes(el.type)&&!el.disabled&&!el.readOnly&&!el.closest?.(".hp")&&el.name.length<100&&!/^(?:registration_no|winner|selected_offer|price_approved|role)$/i.test(el.name));
}
function quoted(v){
 const s=String(v??"");
 // CSV formula injection prevention, but never corrupt ordinary negative numbers.
 const safe=/^[=+@\t\r]/.test(s)||(/^-(?!\d+(?:\.\d+)?$)/.test(s));
 const out=safe?"'"+s:s;
 return '"'+out.replace(/"/g,'""')+'"';
}
const csvRussianNames={carrier:"Перевозчик",contact:"Контактное лицо",amount:"Сумма ставки",currency:"Валюта",mode:"Вид транспорта",plannedKm:"Плановый километраж (км)",pickup:"Дата забора груза",website:"Сайт",route:"Маршрут",eta:"Плановая дата прибытия",departure:"Дата отправления",arrival:"Дата прибытия",weight:"Вес (кг)",volume:"Объём (м³)",container:"Номер контейнера",containerNo:"Номер контейнера",notes:"Примечание",comment:"Комментарий",phone:"Телефон",email:"Электронная почта",status:"Статус",date:"Дата",address:"Адрес",cost:"Стоимость",distance:"Расстояние (км)",plannedDate:"Плановая дата",actualDate:"Фактическая дата"};
function csvFieldTitle(field){
 const key=field.name.split(".").pop();
 const explicit=csvRussianNames[key];if(explicit)return explicit;
 const label=field.labels?.[0]?.textContent||field.closest?.("label")?.textContent||field.closest?.(".form-field,.field,.t2-field")?.querySelector("label")?.textContent||"";
 const cleaned=label.replace(/[\s*]+/g," ").trim();
 if(cleaned&&/[А-Яа-яЁё]/.test(cleaned))return cleaned.slice(0,100);
 const spaced=key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ");
 return "Поле: "+spaced;
}
function csvFieldColumns(fields){
 const counts=new Map();return fields.map(field=>{
  const title=csvFieldTitle(field),count=(counts.get(title)||0)+1;counts.set(title,count);
  return {field,title:count===1?title:title+" ("+count+")"};
 });
}
function exportXlsx(form){
 const api=window.freightXlsxInterop;
 if(!api)throw Error("Модуль Excel-шаблонов не загружен. Обновите страницу.");
 const fields=controls(form),columns=csvFieldColumns(fields);
 if(!fields.length)throw Error("В форме нет полей для экспорта");
 const bytes=api.makeXlsx([columns.map(c=>c.title),fields.map(f=>f.value)]);
 const url=URL.createObjectURL(new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
 const a=document.createElement("a");a.href=url;a.download="freight-form-"+(form.id||"fields")+".xlsx";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function parseCSV(text){
 text=String(text||"").replace(/^\uFEFF/,"");
 if(!text.trim())throw Error("CSV пуст");
 // Count separators outside quotes in the header rather than guessing from body data.
 const counts={";":0,",":0,"\t":0};let quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'&&quoted&&text[i+1]==='"'){i++;continue}
  if(c==='"'){quoted=!quoted;continue}
  if(!quoted&&(c==="\r"||c==="\n"))break;
  if(!quoted&&Object.prototype.hasOwnProperty.call(counts,c))counts[c]++;
 }
 const max=Math.max(...Object.values(counts));
 if(!max)throw Error("В CSV не найден разделитель колонок");
 const variants=Object.keys(counts).filter(k=>counts[k]===max);
 if(variants.length!==1)throw Error("Неоднозначный разделитель CSV: укажите один разделитель (, ; или TAB)");
 const sep=variants[0],rows=[];let row=[],cell="",inQuotes=false,closedQuote=false,fieldStarted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(inQuotes){
   if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
   else if(c==='"'){inQuotes=false;closedQuote=true;}
   else cell+=c;
  }else if(c===sep){
   row.push(cell);cell="";closedQuote=false;fieldStarted=false;
  }else if(c==="\r"||c==="\n"){
   if(c==="\r"&&text[i+1]==="\n")i++;
   row.push(cell);if(row.some(x=>x!==""))rows.push(row);
   row=[];cell="";closedQuote=false;fieldStarted=false;
  }else if(c==='"'){
   if(fieldStarted||closedQuote)throw Error("Недопустимая кавычка в CSV, позиция "+(i+1));
   inQuotes=true;fieldStarted=true;
  }else{
   if(closedQuote)throw Error("Символы после закрывающей кавычки CSV, позиция "+(i+1));
   cell+=c;fieldStarted=true;
  }
 }
 if(inQuotes)throw Error("Незакрытые кавычки в CSV");
 if(row.length||cell!==""){row.push(cell);if(row.some(x=>x!==""))rows.push(row);}
 if(rows.length!==2)throw Error("CSV должен содержать заголовок и ровно одну строку данных");
 if(rows[0].length!==rows[1].length)throw Error("Количество столбцов CSV и значений не совпадает");
 const names=new Set(rows[0]);
 if(names.size!==rows[0].length||names.has(""))throw Error("CSV содержит дублирующиеся или пустые имена столбцов");
 return rows;
}
function setReactValue(element,value){
 const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 const setter=Object.getOwnPropertyDescriptor(prototype,"value")?.set;
 if(setter)setter.call(element,value);else element.value=value;
 element.dispatchEvent(new Event("input",{bubbles:true}));
 element.dispatchEvent(new Event("change",{bubbles:true}));
}
function validCalendarDate(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const [y,m,d]=s.split("-").map(Number);
 if(y<1||y>9999||m<1||m>12)return false;
 return d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();
}
/* Convert date values edited in Excel/WPS into the ISO format required by HTML date inputs. */
function normalizeExcelDate(raw,key){
 const input=String(raw??"").trim(),pad=n=>String(n).padStart(2,"0");
 let iso=input;
 const dmy=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(input);
 const ymd=/^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(input);
 const isoTime=/^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?$/.exec(input);
 if(dmy)iso=dmy[3]+"-"+pad(dmy[2])+"-"+pad(dmy[1]);
 else if(ymd)iso=ymd[1]+"-"+pad(ymd[2])+"-"+pad(ymd[3]);
 else if(isoTime)iso=isoTime[1];
 else if(/^\d{5}(?:[.,]0+)?$/.test(input)){
   const serial=Number(input.replace(",","."));
   const date=new Date(Date.UTC(1899,11,30)+serial*86400000);
   if(Number.isFinite(date.getTime()))iso=date.toISOString().slice(0,10);
 }
 if(!validCalendarDate(iso))throw Error("Поле "+key+": дата «"+input+"» неверна. Используйте ДД.ММ.ГГГГ или YYYY-MM-DD (Excel/WPS).");
 return iso;
}
function validateCsvCell(element,value,key){
 if(value==="")return;
 if(element.maxLength>0&&value.length>element.maxLength)throw Error("Поле "+key+": превышена длина");
 const type=element.type||"";
 if(type==="date"&&!validCalendarDate(value))throw Error("Поле "+key+": используйте действительную дату YYYY-MM-DD");
 if(type==="datetime-local"){
  const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if(!m||!validCalendarDate(m[1])||+m[2]>23||+m[3]>59||+(m[4]||0)>59)throw Error("Поле "+key+": неверная дата/время YYYY-MM-DDTHH:mm");
 }
 if(type==="time"&&!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value))
  throw Error("Поле "+key+": неверное время HH:mm");
 if(type==="number"){
  if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))throw Error("Поле "+key+": неверное число, ведущие нули/экспонента не допускаются");
  const num=Number(value);if(!Number.isFinite(num))throw Error("Поле "+key+": число вне диапазона");
  if(element.min!==""&&num<Number(element.min)||element.max!==""&&num>Number(element.max))throw Error("Поле "+key+": значение вне допустимых границ");
 }
 if(element instanceof HTMLSelectElement&&!element.multiple&&!Array.from(element.options).some(o=>o.value===value&&!o.disabled))
  throw Error("Поле "+key+": значение отсутствует в справочнике выбора");
}
/* Match Excel choices to the actual live dropdown, not to translated labels or placeholders. */
function normalizeExcelChoice(element,raw,key){
 const value=String(raw??"").trim().replace(/\u00a0/g," ").replace(/\s+/g," ");
 if(element.type==="date"&&value!=="")return normalizeExcelDate(value,key);
 if(element.type==="number"&&value!=="")return value.replace(/\s/g,"").replace(",",".");
 if(element.tagName!=="SELECT"||element.multiple||value==="")return value;
 const options=Array.from(element.options).filter(o=>!o.disabled);
 const norm=x=>String(x??"").trim().replace(/\u00a0/g," ").replace(/\s+/g," ").toLocaleLowerCase("ru-RU");
 const lower=norm(value);
 const insurance=/(?:^|\.)insurance$/i.test(element.name)||/^страхование(?:\b|\s|$)/i.test(String(key));
 if(insurance && ["unknown","не определено","не указано","не выбрано","n/a","—","-"].includes(lower))return "";
 const synonyms=insurance?{
   "да":"Включено","yes":"Включено","included":"Включено","включена":"Включено","страховка включена":"Включено",
   "нет":"Не включено","no":"Не включено","not included":"Не включено","без страхования":"Не включено","не включена":"Не включено",
   "by agreement":"По согласованию","upon agreement":"По согласованию"
 }:{};
 const preferred=synonyms[lower]||value;
 const match=options.find(o=>norm(o.value)===norm(preferred)||norm(o.textContent)===norm(preferred));
 if(match)return match.value;
 const allowed=options.map(o=>o.textContent.trim()||o.value).join(" / ");
 throw Error("Поле "+key+": «"+value+"» не является допустимым значением. Выберите: "+allowed+". Остальные поля формы не изменены.");
}
async function importCSV(form,file){
 let rows;
 if(/\.xlsx$/i.test(file.name)){
  const api=window.freightXlsxInterop;
  if(!api)throw Error("Модуль Excel-шаблонов не загружен");
  rows=parseCSV(api.xlsxToCsv(await api.unzip(await file.arrayBuffer())));
 }else{
  rows=parseCSV(await file.text());
 }
 const [headers,data]=rows,fields=controls(form);
 // Earlier rate templates accidentally included the hidden anti-spam field «Сайт».
 // Never map it into the submission form; retain compatibility with those workbooks.
 const honeypot=form.querySelector?.('.hp input[name="website"]');
 const legacyWebsite=key=>Boolean(honeypot)&&/^(?:website|сайт)$/i.test(String(key).trim());
 const skippedWebsite=headers.filter(legacyWebsite);
 const known=new Map(fields.map(f=>[f.name,f]));
 for(const column of csvFieldColumns(fields))known.set(column.title,column.field);
 const unknown=headers.filter(key=>!known.has(key)&&!legacyWebsite(key));
 if(unknown.length)throw Error("Недоступные/неизвестные поля CSV: "+unknown.join(", ").slice(0,400));
 const mapped=headers.map((key,i)=>legacyWebsite(key)?null:({element:known.get(key),key,original:data[i]??"",value:normalizeExcelChoice(known.get(key),data[i]??"",key)})).filter(Boolean);
 const unselected=mapped.filter(x=>x.value===""&&x.original!=="");
 const changes=mapped.filter(x=>x.value!=="");
 if(!changes.length)throw Error("Не найдено значений для переноса в форму");
 // Validate every cell before the first mutation. Failed CSV must never partially fill a form.
 for(const x of changes)validateCsvCell(x.element,x.value,x.key);
 const preview=changes.map(x=>x.key+" : "+String(x.element.value||"—")+" → "+x.value).join("\n").slice(0,2400);
 if(!confirm("Распознано "+changes.length+" из "+fields.length+" полей.\n"+preview+(skippedWebsite.length?"\n\nКолонка «Сайт» из старого шаблона — служебная, пропускается; для ставки не нужна.":"")+(unselected.length?"\n\nПропущены незаполненные варианты: "+unselected.map(x=>x.key).join(", ")+". Выберите их в форме перед отправкой.":"")+"\n\nПрименить значения? Существующие поля не будут очищены. Это НЕ сохранение на сервере."))return;
 for(const {element,value} of changes)setReactValue(element,value);
 // Clean a hidden value imported by the previous (faulty) Excel template.
 if(skippedWebsite.length&&honeypot?.value)setReactValue(honeypot,"");
 alert("Перенесено значений: "+changes.length+"."+(unselected.length?" Не заполнены: "+unselected.map(x=>x.key).join(", ")+". Заполните эти обязательные поля в форме.":"")+" Данные перенесены только в форму — ставка ещё НЕ отправлена. Проверьте обязательные поля и галочку подтверждения, затем нажмите «Отправить все варианты».");
}
/* The native HTML required check accepts whitespace; the API trims it and rejects the quote. */
function quoteSubmitPreflight(event){
 const form=event.target;
 if(!form?.querySelector?.('input[name$=".validUntil"]')||!form.querySelector('input[name="carrier"]'))return;
 const required=Array.from(form.querySelectorAll("input[required],textarea[required],select[required]"));
 const missing=required.find(el=>el.type==="checkbox"?!el.checked:!String(el.value??"").trim());
 if(!missing)return;
 event.preventDefault();
 event.stopPropagation();
 missing.setCustomValidity?.("Заполните обязательное поле перед отправкой ставки.");
 missing.focus?.();
 missing.reportValidity?.();
 const reset=()=>missing.setCustomValidity?.("");
 missing.addEventListener?.("input",reset,{once:true});
 missing.addEventListener?.("change",reset,{once:true});
}
document.addEventListener("submit",quoteSubmitPreflight,true);
function legacyCSV(){
 for(const form of document.querySelectorAll("form")){
  if(form.closest("#task2-root")||form.dataset.task2Csv||form.closest(".auth-card")||form.querySelector('input[type="password"]'))continue;
  const input=controls(form);
  if(input.length<5||input.length>130)continue;
  form.dataset.task2Csv="1";
  const tools=document.createElement("div");tools.className="t2-legacy-csv";
  tools.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:9px 0";
  const download=document.createElement("button");download.type="button";download.className="btn secondary";download.textContent="Скачать Excel-шаблон";download.addEventListener("click",()=>{try{exportXlsx(form)}catch(e){alert(e.message)}});
  const label=document.createElement("label");label.className="btn secondary";label.style.cursor="pointer";label.textContent="Загрузить Excel";
  const upload=document.createElement("input");upload.type="file";upload.accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";upload.hidden=true;label.append(upload);
  upload.addEventListener("change",async()=>{try{if(upload.files[0])await importCSV(form,upload.files[0])}catch(e){alert(e.message)}finally{upload.value=""}});
  tools.append(download,label);form.append(tools);
 }
}
function mount(){
 if(observerPending)return;observerPending=true;
 requestAnimationFrame(()=>{observerPending=false;guidance();faq();supplier();legacyCSV();});
}
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["lang"]});
window.addEventListener("freight-access-updated",mount);
document.addEventListener("DOMContentLoaded",mount);
mount();
})();
