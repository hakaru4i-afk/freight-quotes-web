// OFFER-SCORE-20261117-R3 · Transparent 100-point assessment with Owner-only winner decision.
// A recommendation is NOT the Owner's winner decision. No exchange-rate guesses.
// Compare only one order, round, currency, transport mode and weight.
export const OFFER_SCORE_WEIGHTS=Object.freeze({price:25,days:20,station:10,route:15,border:15,extras:10,insurance:5});
export const OFFER_SCORE_BANDS=Object.freeze([
  {min:90,max:100,level:'dark-green',label:'90–100 · тёмно-зелёный'},
  {min:80,max:89,level:'green',label:'80–89 · зелёный'},
  {min:70,max:79,level:'light-green',label:'70–79 · светло-зелёный'},
  {min:60,max:69,level:'yellow',label:'60–69 · жёлтый'},
  {min:35,max:59,level:'orange',label:'35–59 · оранжевый'},
  {min:0,max:34,level:'orange',label:'0–34 · оранжевый'}
]);
const round=n=>Math.max(0,Math.round(Number(n)||0));
const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
const nonEmpty=s=>Boolean(String(s??'').trim());
const meaningful=s=>nonEmpty(s)&&!/^(?:нет|no|none|n\/a|не применимо|不适用|不详|unknown|—|-)$/.test(norm(s));
const clamp=(v,max)=>Math.min(max,Math.max(0,round(v)));
const eq=(a,b)=>Math.abs(a-b)<0.00001;
const crossed=text=>/(?:маньчжур|manzhouli|满洲里|забайкаль|zabaikalsk|хоргос|khorgos|霍尔果斯|достык|dostyk|алатау|alatau|эрлянь|эрэнхот|erenhot|erlian|二连|замын|zamiin|наушки|naushki|сухэ.?батор|sukhbaatar|брест|brest|козлович|kozlovichi)/iu.test(text);
const stationExplicit=b=>meaningful(b.departure_station)||meaningful(b.departure_port)||meaningful(b.incoterm_place);
const insuranceIncluded=b=>{
  const v=norm(b.insurance);
  if(/(?:не включен|не входит|без страхов|not included|excluded|uninsured|不含保险|未投保)/iu.test(v))return false;
  return /(?:включен|входит|в стоимости|included|insurance included|含保险|已投保)/iu.test(v);
};
export function explicitSurcharge(b){
  const raw=norm(b.extras);
  if(!raw)return {known:false,amount:0,reason:'Дополнительные расходы не раскрыты'};
  if(/^(?:нет(?: доплат)?|отсутствуют|без доплат|none|no additional charges|no extras|0(?:[.,]0+)?(?:\s+[a-z]{3})?|无|无附加费|included|включены)$/.test(raw))return {known:true,amount:0};
  // Only an unconditional single amount in the quoted currency is safe to sum.
  const match=raw.match(/^([\d\s]+(?:[.,]\d{1,2})?)\s*([a-z]{3})$/iu);
  const number=match?Number(match[1].replace(/\s/g,'').replace(',','.')):NaN;
  if(match&&Number.isFinite(number)&&number>=0&&norm(match[2])===norm(b.currency))
    return {known:true,amount:number};
  return {known:false,amount:0,reason:'Доплаты условные, в другой валюте или не указана общая сумма'};
}
function eligibility(b,policies,today){
  if(b.decision!=='accepted')return 'Ставка не допущена владельцем к сравнению';
  if(policies?.[b.submitted_email]?.blocked)return 'Перевозчик заблокирован правилами SL';
  if(!Number.isFinite(Number(b.amount))||Number(b.amount)<=0)return 'Цена не указана или некорректна';
  if(!Number.isFinite(Number(b.days))||Number(b.days)<=0)return 'Срок доставки не указан или некорректен';
  if(b.valid_until&&String(b.valid_until).slice(0,10)<today)return 'Срок действия ставки истёк';
  return '';
}
const tier=score=>OFFER_SCORE_BANDS.find(x=>score>=x.min)||OFFER_SCORE_BANDS.at(-1);
function oneScore(b,minPrice,minDays,base,effectiveCost){
  const extras=explicitSurcharge(b),quoted=Number(b.amount),cost=effectiveCost;
  const route=String(b.route||''),waypoints=String(b.waypoints||'');
  const notes=[],breakdown={};
  breakdown.price=clamp(25*minPrice/cost,25);
  breakdown.days=clamp(20*minDays/Number(b.days),20);
  const explicit=stationExplicit(b),previous=base?.source==='text'&&meaningful(base.station);
  breakdown.station=explicit?10:previous?6:meaningful(b.incoterm_place)?3:0;
  if(!explicit)notes.push('Станция отправления / порт не подтверждены отдельным полем');
  const hasRoute=meaningful(route),hasWaypoints=meaningful(waypoints),hasEndpoints=meaningful(b.origin)&&meaningful(b.destination);
  breakdown.route=hasRoute&&hasWaypoints&&hasEndpoints?15:hasRoute&&hasWaypoints?12:hasRoute?8:hasWaypoints?5:0;
  if(breakdown.route<12)notes.push('Маршрут недостаточно подробно описан');
  const movement=(route+' '+waypoints),cross=crossed(movement);
  breakdown.border=cross?15:hasWaypoints?7:0;
  if(!cross)notes.push('Погранпереходы не подтверждены, логистический риск требует проверки');
  breakdown.extras=extras.known?(extras.amount===0?10:7):0;
  if(!extras.known)notes.push(extras.reason);
  breakdown.insurance=insuranceIncluded(b)?5:0;
  if(!insuranceIncluded(b))notes.push('Страховое покрытие не подтверждено как включённое');
  const rawTotal=Object.values(breakdown).reduce((a,x)=>a+x,0);
  // An unpriced surcharge or undocumented route must never earn a «best offer» quality badge.
  const total=Math.min(rawTotal,!extras.known?79:100,breakdown.route<8?69:100);
  return {score:Math.min(100,total),breakdown,notes,extrasKnown:extras.known,extrasAmount:extras.known?extras.amount:null,
    comparableTotal:extras.known?Number((quoted+extras.amount).toFixed(2)):null,quotedAmount:quoted,
    level:tier(total).level,band:tier(total).label,priceBasis:extras.known?'цена + подтверждённые доплаты':'только заявленная ставка, доплаты требуют проверки',
    riskLevel:notes.length>=3?'high':notes.length?'review':'normal'};
}
function uniqueLeader(items,getter){
  if(items.length<2)return null;
  const best=Math.min(...items.map(getter));
  const matches=items.filter(x=>eq(getter(x),best));
  return matches.length===1?matches[0]:null;
}
export function scoreOffers(bids,policies={},asof=new Date().toISOString(),baseAnalysis={}){
  const today=new Date(Date.parse(asof)+10800000).toISOString().slice(0,10),out={},groups=new Map();
  for(const b of bids||[]){
    const prior=baseAnalysis[b.id]||{},reason=prior.quality==='unavailable'||prior.eligible===false||prior.level==='excluded'?'Сервер исключил ставку из сравнения':eligibility(b,policies,today);
    out[b.id]={...prior,score:null,breakdown:null,category:'исключённая',tags:[],notes:reason?[reason]:[],level:'excluded',band:'Серый · вне сравнения',eligible:!reason};
    if(reason)continue;
    const key=JSON.stringify([b.order_code,b.round_id||'',norm(b.currency),norm(b.mode),norm(b.weight),meaningful(b.weight)?'':b.id]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(b);
  }
  for(const group of groups.values()){
    // Use a confirmed cost only if ALL contenders have clearly stated extras.
    const completeExtras=group.every(b=>explicitSurcharge(b).known);
    const price=b=>Number(b.amount)+(completeExtras?explicitSurcharge(b).amount:0);
    const minPrice=Math.min(...group.map(price)),minDays=Math.min(...group.map(b=>Number(b.days)));
    const ranking=group.map(b=>{
      const previous=out[b.id];
      const s=oneScore(b,minPrice,minDays,previous,price(b));
      const merged={...previous,...s,peers:group.length-1,quality:'review',category:'альтернативная',tags:[]};
      if(!meaningful(b.weight)){merged.notes.push('Вес груза не указан — другие ставки нельзя считать сопоставимыми');merged.score=Math.min(merged.score,69);merged.level=tier(merged.score).level;merged.band=tier(merged.score).label;}
      merged.quotedAmount=Number(b.amount);
      merged.effectiveAmount=price(b);
      merged.priceBasis=completeExtras?'все подтверждённые доплаты включены':'сравнение базовой цены: доплаты не полностью раскрыты';
      out[b.id]=merged;return {b,score:merged.score};
    });
    const cheapest=uniqueLeader(group,price),fastest=uniqueLeader(group,b=>Number(b.days));
    const maxScore=Math.max(...ranking.map(x=>x.score)),top=ranking.filter(x=>x.score===maxScore);
    const balanced=group.length>1&&top.length===1&&completeExtras&&top[0].score>=70?top[0].b:null;
    const bestStation=ranking.length>1&&uniqueLeader(ranking,x=>-out[x.b.id].breakdown.station);
    const bestRoute=ranking.length>1&&uniqueLeader(ranking,x=>-out[x.b.id].breakdown.route);
    const bestBorder=ranking.length>1&&uniqueLeader(ranking,x=>-out[x.b.id].breakdown.border);
    const bestRisk=ranking.length>1&&uniqueLeader(ranking,x=>out[x.b.id].notes.length);
    const worst=group.length>1?ranking.filter(x=>x.score===Math.min(...ranking.map(y=>y.score))):[];
    const worstUnique=worst.length===1?worst[0].b:null;
    for(const b of group){
      const a=out[b.id],competing=group.length>1;
      if(competing&&cheapest?.id===b.id)a.tags.push(completeExtras?'Самая дешёвая с учётом доплат':'Самая низкая заявленная цена (доплаты уточнить)');
      if(competing&&fastest?.id===b.id)a.tags.push('Самая быстрая');
      if(competing&&balanced?.id===b.id)a.tags.push('Самая сбалансированная');
      if(competing&&bestStation?.b.id===b.id&&a.breakdown.station===10)a.tags.push('Лучшая подтверждённая станция отправления');
      if(competing&&bestRoute?.b.id===b.id&&a.breakdown.route>=12)a.tags.push('Лучше описанный маршрут');
      if(competing&&bestBorder?.b.id===b.id&&a.breakdown.border===15)a.tags.push('Лучший подтверждённый погранпереход');
      if(competing&&bestRisk?.b.id===b.id&&a.notes.length<out[group.find(x=>x.id!==b.id)?.id]?.notes?.length)a.tags.push('Меньше неподтверждённых условий');
      if(competing&&top.length>1&&a.score===maxScore)a.tags.push('Равная итоговая оценка — решение владельца / конкурс');
      if(competing&&worstUnique?.id===b.id)a.tags.push('Худшая сводная оценка в группе');
      a.category=a.notes.length>=3||!completeExtras?'сомнительная':balanced?.id===b.id?'наиболее сбалансированная':'альтернативная';
      a.quality=a.notes.length>=3||!completeExtras?'review':balanced?.id===b.id?'good':'alternative';
      a.isBalancedLeader=balanced?.id===b.id;
      a.isWorst=worstUnique?.id===b.id;
      a.tieForBest=top.length>1&&a.score===maxScore;
      a.groupSize=group.length;
      a.uniqueBest=top.length===1&&a.score===maxScore&&completeExtras;
      a.unconfirmedConditions=a.notes.length;
      a.worstFlag=worstUnique?.id===b.id? 'Худшая оценка среди сравнимых' : null;
      a.methodology='OFFER-SCORE-20261117-R3 · Цена25 / Срок20 / Станция10 / Маршрут15 / Переходы15 / Доплаты10 / Страхование5';
      a.comparable=group.length>1;
      a.compareKey=[b.order_code,b.round_id||'',norm(b.currency),norm(b.mode),norm(b.weight)].join(' / ');
      if(!completeExtras)a.notes.push('Доплаты раскрыты не у всех: это предварительная оценка, а не полная стоимость');
      a.ownerDecisionRequired=true;
    }
  }
  return out;
}
