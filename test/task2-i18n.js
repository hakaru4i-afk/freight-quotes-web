/* Task2 staging-only language layer; translates static labels, never stored customer data. */
(function(){
"use strict";
const dict={
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
  "Растаможка":["Customs clearance","清关"],
  "Приёмка склада":["Warehouse receipt","仓库收货"],
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
  "Фактическая дата растаможки (Минск)":["Customs completion (Minsk)","实际清关时间（明斯克）"],
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
  "Загрузить CSV":["Upload CSV","上传 CSV"]
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
  if(node.parentElement?.closest("script,style,textarea"))continue;
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
