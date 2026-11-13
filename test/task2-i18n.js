/* Task2 staging-only language layer; translates static labels, never stored customer data. */
(function(){
"use strict";
const dict={
"3D-глобус":["3D globe","3D地球"],"2D-карта":["2D map","2D地图"],"Режим карты":["Map mode","地图模式"],"Приблизить":["Zoom in","放大"],"Отдалить":["Zoom out","缩小"],"К маршруту":["Fit route","显示路线"],"Маршрут заявки":["Request route","申请路线"],"Маршрут перевозки":["Shipment route","运输路线"],"Контроль перевозки":["Shipment overview","运输概况"],"Объект":["Facility","设施"],"Пунктов с координатами":["Stops with coordinates","有坐标的地点"],"На карте показана схема перевозки. Точная трасса и GPS-позиция не подтверждены.":["The map shows the shipment plan. The exact path and GPS position are not verified.","地图显示运输计划。精确路径和GPS位置尚未确认。"],"Определить координаты маршрута":["Resolve route locations","确定路线坐标"],

"Еженедельный отчёт перевозчика, не GPS в реальном времени.":["Weekly carrier report, not live GPS.", "承运商每周报告，并非实时GPS。"],
"Сообщения о местонахождении груза":["Reported cargo locations", "货物位置报告"],
"Расстояние перевозки":["Shipment distance", "运输距离"],
"Центр города":["City center, approximate", "城市中心（近似）"],
"Нет координат":["No coordinates", "无坐标"],
"Координаты":["Coordinates", "坐标"],
"Уточнить геоточку":["Clarify location", "地点"],
"Исходный адрес сохраняется; уточнение и подтверждение записываются в аудит.":["The original address is retained; clarification and confirmation are audited.", "保留原地址；澄清与确认将记录在审计中。"],
"Выберите подтверждённый результат":["Select a verified result", "选择已验证的结果"],
"Уточнение: страна, город, объект":["Clarification: country, city, facility", "澄清：国家、城市、设施"],
"Причина уточнения":["Reason for clarification", "澄清原因"],
"Подтверждаю уточнение":["I confirm this clarification", "我确认此澄清"],
"Сохранить уточнение":["Save clarification", "保存澄清"],
"Повторить геокодирование":["Retry geocoding", "重试地理编码"],
"Погрузка · владелец":["Loading · Owner", "装货 · 货主"],
"Доставка · владелец":["Delivery · Owner", "交货 · 货主"],
"Станция / порт отправления · перевозчик":["Departure station / port · Carrier", "起运站/港口 · 承运商"],
"Маршрут ставки · перевозчик":["Quoted route · Carrier", "报价路线 · 承运商"],
"Порядок не указан":["Order requires clarification", "顺序需要澄清"],
"Кабинет логиста":["Logistics workspace", "物流工作台"],
"Адресные запросы документов":["Addressed document requests", "指定文件请求"],
"Здесь доступны только назначенные вам запросы ВЭД и прикреплённые к ним файлы.":["Only document requests assigned to you by foreign trade and their linked files are available here.", "此处仅显示外贸部门分配给您的文件请求及关联文件。"],
"Запрос ВЭД":["Foreign-trade request", "外贸请求"],
"РАБОЧЕЕ ПРОСТРАНСТВО ЛОГИСТА":["LOGISTICS WORKSPACE", "物流工作台"],
"Назначенные вам запросы ВЭД и связанные с ними файлы.":["Foreign-trade requests assigned to you and their linked files.", "外贸部门分配给您的请求及关联文件。"],
"Открыть запросы документов →":["Open document requests →", "打开文件请求 →"],
"Запросы документов":["Document requests", "文件请求"],
"Проверка ВЭД при недоступном километраже":["Foreign-trade review when distance is unavailable", "无法计算里程时的外贸审核"],
"Причина":["Reason", "原因"],
"Основание: документ или ссылка на подтверждение":["Evidence: document or reference", "证明：文件或参考链接"],
"Запустить единственную проверку ВЭД":["Start the single foreign-trade review", "发起唯一外贸审核"],
"Только при документированной невозможности расчёта. Дата и пользователь записываются сервером. Проверка ВЭД остаётся обязательной.":["Only for documented calculation unavailability. The server records user and date. The foreign-trade review remains required.", "仅适用于有证明的无法计算情况。服务器记录操作人和日期。外贸审核仍为必需。"],

  "Исполнение и трекинг":["Execution & tracking","运输执行与跟踪"],
  "Данные заявки":["Request details","申请详情"],
  "Документы и ВЭД":["Documents & foreign trade","文件与外贸"],
  "ПТО и приёмка":["Inspection & receipt","检验与收货"],
  "Претензии и акты":["Claims & reports","索赔与报告"],
  "История":["History","历史记录"],
  "Рег. №":["Registration No.","登记编号"],
  "Рег. № заявки":["Request registration No.","申请登记编号"],
  "Номер заказа":["Order No.","订单编号"],
  "Заказ":["Order","订单"],
  "Номера Bitrix":["Bitrix task numbers","Bitrix 任务编号"],
  "Перевозчик":["Carrier","承运商"],
  "Выбранный перевозчик":["Selected carrier","中选承运商"],
  "Статус":["Status","状态"],
  "Ставка":["Rate","报价"],
  "Ставка победителя":["Winning rate","中标报价"],
  "Валюта":["Currency","币种"],
  "Транспорт":["Transport","运输方式"],
  "Маршрут":["Route","路线"],
  "Груз":["Cargo","货物"],
  "Вес/объём":["Weight / volume","重量／体积"],
  "Контакт отправителя":["Shipper contact","发货人联系方式"],
  "Исходная плановая дата выхода":["Original planned departure","原计划发运日期"],
  "Фактическая дата выхода":["Actual departure","实际发运日期"],
  "Не указана":["Not specified","未填写"],
  "не присвоен":["Not assigned","未分配"],
  "Ожидает принятия":["Awaiting acceptance","等待接单"],
  "Ожидается действие выбранного перевозчика.":["Waiting for the selected carrier.","等待中选承运商操作。"],
  "Контейнер":["Container","集装箱"],
  "Что требуется?":["What is needed?","需要什么？"],
  "Направить запрос ВЭД":["Request documents from foreign trade","向外贸部门申请文件"],
  "Сообщение":["Message","消息"],
  "Отправить сообщение":["Send message","发送消息"],
  "Исходная плановая дата (заблокирована)":["Original planned date (locked)","原计划日期（不可修改）"],
  "Сохранить изменения":["Save changes","保存更改"],
  "Сохраняем…":["Saving…","保存中…"],
  "Изменения сохранены.":["Changes saved.","更改已保存。"],
  "Выберите файлы":["Select files","选择文件"],
  "ПТО":["Inspection checkpoint","检验站"],
  "Дата завершения таможенного оформления":["Customs clearance completion date","海关清关完成日期"],
  "Дата приёмки груза на складе":["Cargo warehouse receipt date","货物入库验收日期"],
  "Общая длина маршрута, км":["Total route distance, km","路线总里程（公里）"],
  "Осталось по маршруту, км":["Distance remaining, km","剩余里程（公里）"],
  "не рассчитано":["Not calculated","未计算"],
  "Причина переноса":["Reason for rescheduling","改期原因"],
  "Фактическая дата выхода (Минск)":["Actual departure (Minsk time)","实际发运时间（明斯克）"],
  "Местонахождение груза":["Cargo location","货物位置"],
  "Дата и время контрольной точки (Минск)":["Checkpoint date/time (Minsk)","节点日期／时间（明斯克）"],
  "Примечание к точке":["Checkpoint note","节点备注"],
  "Прибыл на ПТО":["Arrived at inspection","已到检验站"],
  "Дата прибытия на ПТО (Минск)":["Inspection arrival (Minsk)","到达检验站时间（明斯克）"],
  "Дата завершения импортного таможенного оформления (Минск)":["Import customs clearance completion date (Minsk)","进口清关完成日期（明斯克）"],
  "Исходная дата":["Original date","原始日期"],
  "Карта груза":["Cargo map","货物地图"],
  "Проверка ВЭД":["Foreign-trade review","外贸审核"],
  "Станции / вагоны":["Stations / wagons","车站／车厢"],
  "Пломбы / контейнер":["Seals / container","封条／集装箱"],
  "Номер рейса":["Flight number","航班号"],
  "Аэропорты":["Airports","机场"],
  "Судно / рейс":["Vessel / voyage","船舶／航次"],
  "Порты / пломбы":["Ports / seals","港口／封条"],
  "Автомобиль / прицеп":["Truck / trailer","卡车／挂车"],
  "Водитель / место разгрузки":["Driver / unloading location","司机／卸货地点"],
  "ЖД":["Rail","铁路"],
  "Авиа":["Air","空运"],
  "Море":["Sea","海运"],
  "Авто":["Road","公路"],
  "Основание и обстоятельства":["Grounds and circumstances","事由与情况"],
  "Сумма требований":["Claim amount","索赔金额"],
  "Требования / пояснения":["Claim details / notes","索赔要求／说明"],
  "Сохранить акт":["Save report","保存报告"],
  "Основание завершения спорной перевозки":["Reason for closing disputed shipment","结束争议运输的理由"],
  "При спорном акте решение обязательно":["A decision is required for a disputed report","有争议的报告必须作出决定"],
  "Закрыть претензионную перевозку":["Close shipment with claim","结束有索赔的运输"],
  "Транспортная заявка":["Transport application","运输委托书"],
  "Файлы":["Files","文件"],
  "Инвойс":["Invoice","发票"],
  "Упаковочный лист":["Packing list","装箱单"],
  "Экспортная декларация":["Export declaration","出口报关单"],
  "Транзитная декларация":["Transit declaration","过境报关单"],
  "Сертификат":["Certificate","证书"],
  "Фото погрузки":["Loading photos","装货照片"],
  "Страховой полис":["Insurance policy","保险单"],
  "Инструкция":["Manual","说明书"],
  "Другое":["Other","其他"],
  "Акт":["Report","报告"],
  "Акт по автомобильной перевозке":["Road transport report","公路运输报告"],
  "Акт по железнодорожной перевозке":["Rail transport report","铁路运输报告"],
  "Акт по авиационной перевозке":["Air transport report","航空运输报告"],
  "Акт по морской перевозке":["Sea transport report","海运报告"],
  "Редакция":["Revision","版本"],
  "Дата":["Date","日期"],
  "Инвойс / Packing list":["Invoice / packing list","发票／装箱单"],
  "Дата фактической приёмки на складе (YYYY-MM-DDTHH:mm)":["Actual warehouse receipt (YYYY-MM-DDTHH:mm)","实际仓库收货时间（YYYY-MM-DDTHH:mm）"],
  "Завершить задачу ВЭД после проверки документов?":["Complete foreign-trade task after verifying documents?","文件审核后完成外贸任务吗？"],
  "Выберите CSV-файл":["Choose CSV file","选择 CSV 文件"],
  "Выберите один или несколько файлов":["Select one or more files","选择一个或多个文件"],
  "Ожидает":["Pending","待处理"],
  "Ошибка":["Error","错误"],
  "Ошибка сервера":["Server error","服务器错误"],
  "Ошибка скачивания":["Download error","下载错误"],
  "Нет доступа":["Access denied","无权访问"],
  "Нет ответа API":["No API response","API 无响应"],
  "Скачать CSV шаблон":["Download CSV template","下载 CSV 模板"],
  "Загрузить CSV":["Upload CSV","上传 CSV"],
  "Номер контейнера. Необязателен до завершения; после запроса ВЭД укажите действительный номер.":["Container number. Optional until closure; provide the actual number when requested by foreign trade staff.", "箱号在结束前可选。外贸人员提出请求后请填写真实箱号。"],
  "Фактическая дата и время выхода груза. После сохранения первоначальная дата и все переносы остаются в истории.":["Actual cargo departure date and time. The initial date and all reschedules remain in history.", "货物实际发运日期和时间。最初日期及全部延期记录均保留。"],
  "Новая плановая дата выхода. Добавляйте любое количество раз, пока не указана фактическая дата.":["New planned departure date. Add as many changes as needed until actual departure is recorded.", "新的计划发运日期。实际发运前可以多次新增。"],
  "Обязательно опишите объективную причину переноса; запись сохранится в истории.":["Explain the objective reason for rescheduling; the entry remains in history.", "必须说明延期的客观原因，记录将保留在历史中。"],
  "Место нахождения груза: город, терминал, станция, порт или адрес. Добавляется отдельной записью.":["Cargo location: city, terminal, station, port or address. Each observation is a separate entry.", "货物所在地：城市、场站、车站、港口或地址。每次观察单独记录。"],
  "Дата и время события; укажите время Минска или локальное время с пояснением.":["Event date and time. Use Minsk time or clearly explain the local timezone.", "事件日期和时间。使用明斯克时间，或明确说明当地时区。"],
  "Опишите какие документы требуются, зачем и какие именно отсутствуют. Каждая отправка — отдельная задача ВЭД.":["Describe the required or missing documents and why they are needed. Each submission creates a foreign-trade task.", "说明需要或缺少哪些文件及原因。每次发送均创建一个外贸任务。"],
  "Выберите несколько видов документов, если требуется. Вариант «Другое» позволяет уточнить запрос в описании.":["Select multiple document types if needed. Explain Other in the request description.", "可选择多种文件类型。如选其他，请在描述中说明。"],
  "Связанная задача ВЭД, наследует все номера Bitrix исходного заказа. Не заменяет заказ.":["Linked foreign-trade task. It inherits every Bitrix number from the parent order and does not replace the order.", "关联的外贸任务继承原订单全部 Bitrix 编号，不替代订单。"],
  "Дополнительное пояснение, видимое ВЭД, перевозчику и Владельцу.":["Additional explanation visible to authorized foreign trade staff, the carrier and the owner.", "补充说明仅对有权限的外贸人员、承运商及所有者显示。"],
  "Описание нарушения, недостачи или повреждения, основание и требование к перевозчику.":["Describe the violation, shortage or damage, the grounds and the demand addressed to the carrier.", "说明违规、短缺或损坏情况、依据及对承运商的要求。"],
  "Сумма требований в валюте утверждённой ставки, если применимо.":["Claim amount in the currency of the winning quote, if applicable.", "适用时按中选报价币种填写索赔金额。"],
  "Документ/фото доказательство. Загруженные файлы отображаются в документах и чате заявки.":["Evidence document or photo. Uploaded files appear in the shipment documents and chat.", "证据文件或照片。上传后显示在运输文件及聊天中。"],
  "Общий чат именно этой выигранной перевозки: ВЭД, перевозчик и Владелец.":["Shared chat for this winning shipment only: foreign trade staff, carrier and owner.", "仅用于本次中选运输的共享聊天：外贸人员、承运商和所有者。"]
};
const originalTexts=new WeakMap();
const originalAttributes=new WeakMap();
const language=()=>/^zh/i.test(document.documentElement.lang)?"zh":/^en/i.test(document.documentElement.lang)?"en":"ru";
const value=(ru,lang)=>dict[ru]?.[lang==="en"?0:1]||ru;
function update(){
 const root=document.querySelector("#task2-root");
 if(!root)return;
 const lang=language();
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest("script,style,textarea,.t2-readonly strong,.t2-chat,.t2-item span"))continue;
  const raw=originalTexts.get(node)??node.nodeValue;
  const stripped=raw.trim();
  if(!dict[stripped])continue;
  if(!originalTexts.has(node))originalTexts.set(node,raw);
  const replacement=lang==="ru"?raw:raw.replace(stripped,value(stripped,lang));
  if(node.nodeValue!==replacement)node.nodeValue=replacement;
 }
 for(const el of root.querySelectorAll("[placeholder],[title],[aria-label]")){
  let originals=originalAttributes.get(el);
  if(!originals){originals={};for(const a of ["placeholder","title","aria-label"])if(el.hasAttribute(a))originals[a]=el.getAttribute(a);originalAttributes.set(el,originals);}
  for(const [a,ru] of Object.entries(originals)){
   if(!dict[ru])continue;
   const text=lang==="ru"?ru:value(ru,lang);
   if(el.getAttribute(a)!==text)el.setAttribute(a,text);
  }
 }
}
let queued=false;
function schedule(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{queued=false;update();});
}
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["lang"],childList:true,subtree:true,characterData:true});
document.addEventListener("DOMContentLoaded",schedule);
window.addEventListener("freight-access-updated",schedule);
schedule();
})();
