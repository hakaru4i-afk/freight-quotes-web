// Reporting presentation only. Rows MUST come from the authorized reports endpoint.
export const REPORT_ROLES=Object.freeze(["owner","carrier","logistic","supplier","designer","content","purchasing","certification"]);
const TYPES=Object.freeze({
 content_assignment:["Задачи контента","Content assignments","内容任务"],
 purchasing_assignment:["Задачи закупок","Purchasing assignments","采购任务"],
 certification_assignment:["Задачи сертификации","Certification assignments","认证任务"],
 application:["Согласование заявки","Application approval","申请审批"],
 customs_review:["Проверка документов ПТО","Customs document review","清关文件审核"],
 warehouse_review:["Приёмка склада","Warehouse acceptance","仓库验收"],
 claim_review:["Претензии","Claims","索赔"],
 supplier:["Задачи поставщика","Supplier tasks","供应商任务"],
 designer:["Дизайн и контент","Design and content","设计与内容"],
 selection:["Отбор перевозчика","Carrier selection","承运商选择"],
 shipment:["Перевозки","Shipments","运输"],
 invitation:["Запросы ставок","Quote invitations","报价邀请"],
 offer:["Варианты ставок","Quote variants","报价方案"]
});
const TITLES=Object.freeze({
 owner:["Сводная аналитика","Management analytics","综合分析"],
 carrier:["Аналитика перевозчика","Carrier analytics","承运商分析"],
 logistic:["Логистика и ВЭД","Logistics analytics","物流分析"],
 supplier:["Аналитика поставщика","Supplier analytics","供应商分析"],
 designer:["Аналитика дизайна","Design analytics","设计分析"],
 content:["Аналитика контента","Content analytics","内容分析"],
 purchasing:["Аналитика закупок","Purchasing analytics","采购分析"],
 certification:["Аналитика сертификации","Certification analytics","认证分析"]
});
const langIndex=lang=>lang==="zh"?2:lang==="en"?1:0;
const tr=(a,lang)=>a[langIndex(lang)];
export function reportChartData(rows,role,lang="ru"){
 if(!REPORT_ROLES.includes(role))return null;
 const valid=Array.isArray(rows)?rows.filter(r=>r&&typeof r==="object"):[];
 const counts=new Map(),days=new Map();
 let missingDate=0;
 for(const row of valid){
  // Quote variants are not independent workload stages. Do not add them to the timeline.
  const type=String(row.type||"unknown");counts.set(type,(counts.get(type)||0)+1);
  if(type==="offer")continue;
  if(!row.created||!Number.isFinite(Date.parse(row.created))){missingDate++;continue;}
  const day=new Date(row.created).toLocaleDateString("sv-SE",{timeZone:"Europe/Minsk"}).slice(0,7);
  days.set(day,(days.get(day)||0)+1);
 }
 return {title:tr(TITLES[role],lang),
  typesTitle:tr(["Записи по типам (варианты ставок отдельно)","Records by type (quote variants separate)","按类型统计（报价方案单列）"],lang),
  timelineTitle:tr(["Этапы по месяцу создания, без вариантов ставок","Stages by creation month, excluding quote variants","按创建月份统计阶段（不含报价方案）"],lang),
  empty:tr(["Нет данных за выбранный период","No data for the selected period","所选期间无数据"],lang),
  missingLabel:tr(["Этапы без даты создания","Stages without creation date","无创建日期的阶段"],lang),missingDate,
  types:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([type,value])=>({key:type,label:TYPES[type]?tr(TYPES[type],lang):type,value})),
  timeline:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,label:key,value}))
 };
}
