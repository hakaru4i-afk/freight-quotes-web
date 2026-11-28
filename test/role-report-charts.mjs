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
const ASSIGNMENT_ROLES=Object.freeze(["content","purchasing","certification"]);
const ASSIGNMENT_STATES=Object.freeze({
 assigned:["Назначено","Assigned","已分配"],new:["Новая","New","新建"],in_progress:["В работе","In progress","进行中"],
 completed:["Выполнено","Completed","已完成"],cancelled:["Отменено","Cancelled","已取消"],
 deleted:["Удалено","Deleted","已删除"],annulled:["Аннулировано","Annulled","已作废"],superseded:["Заменено","Superseded","已替换"],
 rejected:["Отклонено","Rejected","已拒绝"],declined:["Отказ","Declined","已拒绝"],pending:["Ожидает","Pending","待处理"],
 unknown:["Статус не указан","Status not specified","状态未指定"]
});
const langIndex=lang=>lang==="zh"?2:lang==="en"?1:0;
const tr=(a,lang)=>a[langIndex(lang)];
export function reportChartData(rows,role,lang="ru"){
 if(!REPORT_ROLES.includes(role))return null;
 const valid=Array.isArray(rows)?rows.filter(r=>r&&typeof r==="object"):[];
 const counts=new Map(),days=new Map(),assignmentStates=new Map();
 const showAssignments=role==="owner"||ASSIGNMENT_ROLES.includes(role);
 let missingDate=0;
 for(const row of valid){
  // Quote variants are not independent workload stages. Do not add them to the timeline.
  const type=String(row.type||"unknown");counts.set(type,(counts.get(type)||0)+1);
  if(showAssignments&&(role==="owner"?ASSIGNMENT_ROLES.some(x=>type===x+"_assignment"):type===role+"_assignment")){
   const state=String(row.state||"unknown");assignmentStates.set(state,(assignmentStates.get(state)||0)+1);
  }
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
  assignmentStatusTitle:showAssignments?tr(["Назначенные задачи по статусам","Assigned tasks by status","已分配任务状态统计"],lang):null,
  assignmentStatuses:[...assignmentStates].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,label:ASSIGNMENT_STATES[key]?tr(ASSIGNMENT_STATES[key],lang):key,value})),
  types:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([type,value])=>({key:type,label:TYPES[type]?tr(TYPES[type],lang):type,value})),
  timeline:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,label:key,value}))
 };
}

// Carrier counts are derived from already authorized and filtered rows. Round IDs,
// not order strings or variant counts, are the denominator. No guessed legacy IDs.
export function carrierReportCounts(rows,sources=[]){
 const loaded=path=>sources.some(s=>s.path===path&&s.status==="ok");
 const invitations=new Set(),quoted=new Set(),wins=new Set(),timely=new Set(),late=new Set(),unknown=new Set();
 const active=new Set(),completed=new Set();
 let variants=0,unlinked=0,claims=0,documents=0,claimsKnown=true,docsKnown=true;
 for(const row of Array.isArray(rows)?rows:[]){
  if(!row)continue;
  const key=typeof row.sourceKey==="string"&&row.sourceKey?row.sourceKey:null;
  if(row.type==="invitation"){
   if(key){invitations.add(key);if(row.roundResult==="winner")wins.add(key);}else unlinked++;
  }else if(row.type==="offer"){
   variants++;
   if(!key){unlinked++;continue;}
   quoted.add(key);if(row.roundResult==="winner")wins.add(key);
   if(row.quoteLate===false)timely.add(key);else if(row.quoteLate===true)late.add(key);else unknown.add(key);
  }else if(row.type==="shipment"){
   if(key)wins.add(key);
   if(row.id&&!row.archived&&row.state!=="completed"&&!["failed","annulled"].includes(row.state))active.add(row.id);
   if(row.id&&row.state==="completed")completed.add(row.id);
   if(Number.isInteger(row.claimCount)&&row.claimCount>=0)claims+=row.claimCount;else claimsKnown=false;
   if(Number.isInteger(row.documentCount)&&row.documentCount>=0)documents+=row.documentCount;else docsKnown=false;
  }
 }
 const offersLoaded=loaded("/api/carrier"),shipmentsLoaded=loaded("/api/shipments");
 return {invitedRounds:offersLoaded?invitations.size:null,quotedRounds:offersLoaded?quoted.size:null,
  quoteVariants:offersLoaded?variants:null,wonRounds:offersLoaded&&shipmentsLoaded?wins.size:null,
  timelyQuoteRounds:offersLoaded?timely.size:null,
  lateOnlyQuoteRounds:offersLoaded?[...late].filter(k=>!timely.has(k)&&!unknown.has(k)).length:null,
  unknownTimingRounds:offersLoaded?[...unknown].filter(k=>!timely.has(k)).length:null,
  activeShipments:shipmentsLoaded?active.size:null,completedShipments:shipmentsLoaded?completed.size:null,
  shipmentClaims:shipmentsLoaded&&loaded("report-shipment-claims")&&claimsKnown?claims:null,
  shipmentDocuments:shipmentsLoaded&&loaded("report-shipment-documents")&&docsKnown?documents:null,
  unlinkedRoundRows:offersLoaded?unlinked:null};
}

const CARRIER_KPIS=Object.freeze({
 invitedRounds:["Раунды приглашений","Invited rounds","受邀轮次"],
 quotedRounds:["Раунды со ставками","Quoted rounds","已报价轮次"],
 quoteVariants:["Варианты ставок","Quote variants","报价方案"],
 wonRounds:["Выигранные раунды","Won rounds","获胜轮次"],
 timelyQuoteRounds:["Раунды со ставкой вовремя","Rounds with on-time quotes","及时报价轮次"],
 lateOnlyQuoteRounds:["Раунды только с поздними ставками","Late-only quote rounds","仅逾期报价轮次"],
 unknownTimingRounds:["Раунды с неизвестной своевременностью","Rounds with unknown timing","报价时效未知轮次"],
 activeShipments:["Активные перевозки","Active shipments","在途及进行中运输"],
 completedShipments:["Завершённые перевозки","Completed shipments","已完成运输"],
 shipmentClaims:["Претензии по выбранным перевозкам","Claims on selected shipments","所选运输的索赔"],
 shipmentDocuments:["Документы по выбранным перевозкам","Documents on selected shipments","所选运输的单据"],
 unlinkedRoundRows:["Записи без идентификатора раунда","Records without a round ID","缺少轮次编号的记录"]
});
export function carrierKpiData(rows,sources,currentSL,lang="ru"){
 const counts=carrierReportCounts(rows,sources);
 const noData=tr(["Нет данных","No data","无数据"],lang);
 return {title:tr(["Показатели перевозчика","Carrier performance","承运商绩效"],lang),
  scope:tr(["Показатели по выбранным записям; SL на момент отчёта, вне фильтра периода. Документы и претензии относятся к выбранным перевозкам.","Metrics on selected records; current SL is outside the period filter. Documents and claims belong to the selected shipments.","按所选记录统计；当前服务等级不受期间筛选影响。单据和索赔属于所选运输。"],lang),
  items:[...Object.entries(counts).map(([key,value])=>({key,label:tr(CARRIER_KPIS[key],lang),value:value===null?noData:value})),
    {key:"currentSL",label:tr(["Текущий SL","Current SL","当前服务等级"],lang),value:Number.isFinite(currentSL)?currentSL+"%":noData}]};
}
// Equal-length adjacent calendar periods, using the existing report filter
// for both intervals (including assignment, archive and Minsk date field).
// These are counts of records by selected date, not historical status snapshots.
export function reportPeriodComparison(rows,filters,filterRows){
 const date=value=>{
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const ms=Date.parse(value+"T00:00:00Z");
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?ms:null;
 };
 const a=date(filters?.from),b=date(filters?.to);
 if(a===null||b===null||b<a)return null;
 const day=86400000,length=(b-a)/day+1;
 const iso=ms=>new Date(ms).toISOString().slice(0,10);
 const previous={from:iso(a-length*day),to:iso(a-day)};
 const current={from:filters.from,to:filters.to};
 const left=filterRows(rows,{...filters,...previous}),right=filterRows(rows,{...filters,...current});
 const count=list=>{
  const groups=new Map();
  for(const row of list){
   const key=String(row.type||"unknown");
   groups.set(key,(groups.get(key)||0)+1);
  }
  return groups;
 };
 const p=count(left),c=count(right),keys=[...new Set([...p.keys(),...c.keys()])].sort();
 return {current,previous,dateBy:filters.dateBy||"created",
  items:keys.map(key=>({key,current:c.get(key)||0,previous:p.get(key)||0,delta:(c.get(key)||0)-(p.get(key)||0)})),
  rowIds:[...new Set([...left,...right].map(row=>row.id))]};
}

export function periodComparisonView(comparison,lang="ru"){
 if(!comparison)return null;
 return {title:tr(["Сравнение с предыдущим равным периодом","Comparison with previous equal period","与上一等长期间比较"],lang),
  scope:tr(["Записи по выбранной дате; варианты ставок отдельно. Это не исторический снимок статусов.","Records by selected date; quote variants separate. This is not a historical status snapshot.","按所选日期统计；报价方案单列。这不是历史状态快照。"],lang),
  labels:[tr(["Тип записи","Record type","记录类型"],lang),tr(["Текущий","Current","本期"],lang),tr(["Предыдущий","Previous","上期"],lang),tr(["Разница","Change","变化"],lang)],
  current:comparison.current,previous:comparison.previous,dateBy:comparison.dateBy,
  items:comparison.items.map(x=>({...x,label:TYPES[x.key]?tr(TYPES[x.key],lang):x.key}))};
}
