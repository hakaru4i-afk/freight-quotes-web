/* OWNER-OFFER-EVAL-20261117-R3. Read-only view for the authenticated Owner. */
import {scoreOffers,OFFER_SCORE_WEIGHTS,OFFER_SCORE_BANDS} from './offer-scoring.mjs';
const ID='ow-offer-score-panel-r3';
const CRITERIA=[['price','Цена'],['days','Срок'],['station','Станция / порт'],['route','Маршрут'],['border','Погранпереходы'],['extras','Доплаты'],['insurance','Страхование']];
const s={bids:[],analysis:{},selection:'',busy:false,loaded:false,error:''};
const elem=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(cls)n.className=cls;return n;};
const ownerSection=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"] .cabinet-panel[data-section="offers"]');
const key=b=>String(b.order_code||'')+'|'+String(b.round_id||'');
const money=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2}):'—';
const legacy=section=>[...section.querySelectorAll('p,div,aside')].filter(x=>!x.closest('#'+ID)&&x.textContent?.includes('КРИТЕРИИ СОПОСТАВЛЕНИЯ')&&x.textContent.length<1900&&!x.querySelector('table,button,input,select,textarea')).sort((a,b)=>a.textContent.length-b.textContent.length)[0];
async function load(){
 if(s.busy||!ownerSection())return;
 s.busy=true;s.error='';show();
 try{
  const [dr,ar]=await Promise.all([fetch('/api/data',{cache:'no-store'}),fetch('/api/offer-analysis',{cache:'no-store'})]);
  if(!dr.ok||!ar.ok)throw Error('API сравнения: HTTP '+dr.status+' / '+ar.status);
  const d=await dr.json(),a=await ar.json();
  if(d.role!=='owner'||!Array.isArray(d.bids)||!a.analysis||typeof a.analysis!=='object')throw Error('Доступ владельца или состав данных не подтверждён');
  s.bids=d.bids.filter(b=>b&&b.id&&b.order_code);
  s.analysis=a.analysis;
  const ids=new Set(s.bids.map(key));if(!ids.has(s.selection))s.selection=s.bids.length?key(s.bids[0]):'';
  s.loaded=true;
 }catch(e){s.error=String(e.message||e);s.loaded=true;}
 finally{s.busy=false;show();}
}
function show(){
 const host=ownerSection()?.querySelector('#'+ID);if(!host)return;
 host.replaceChildren();
 host.append(elem('h3','Оценка предложений · 100 баллов'));
 host.append(elem('p','Сравниваются только предложения одного заказа и раунда, с одинаковой валютой, видом транспорта и весом. Оценка справочная — победителя выбирает только владелец.','ow-os-hint'));
 const weights=elem('div',undefined,'ow-os-weights');
 CRITERIA.forEach(([k,label])=>{const box=elem('div',undefined,'ow-os-weight');box.append(elem('strong',String(OFFER_SCORE_WEIGHTS[k])+' баллов'),elem('span',label));weights.append(box);});
 host.append(weights);
 const bands=elem('div',undefined,'ow-os-bands');
 OFFER_SCORE_BANDS.forEach(b=>bands.append(elem('span',b.label,'ow-os-band ow-os-'+b.level)));
 bands.append(elem('span','Вне сравнения · серый','ow-os-band ow-os-excluded'),elem('span','Худшая сводная оценка · красная пометка','ow-os-band ow-os-worst'));
 host.append(bands);
 host.append(elem('p','Отдельные категории: лучшая цена, самый быстрый срок, лучшая станция, лучший маршрут, лучший погранпереход, сбалансированная ставка, требует уточнения. Неизвестные доплаты не считаются нулевыми.','ow-os-hint'));
 const controls=elem('div',undefined,'ow-os-controls');
 const label=elem('label','Заявка / раунд '),select=elem('select');
 select.setAttribute('aria-label','Выбор заявки для оценки');
 const options=new Map(s.bids.map(b=>[key(b),b]));
 for(const [value,b] of options){const op=elem('option',b.order_code+' · '+String(b.round_id||'без раунда').slice(0,12));op.value=value;select.append(op);}
 select.value=s.selection;select.disabled=s.busy||!s.bids.length;
 select.addEventListener('change',()=>{s.selection=select.value;show();});label.append(select);
 const refresh=elem('button','Пересчитать');refresh.type='button';refresh.disabled=s.busy;refresh.addEventListener('click',()=>void load());
 controls.append(label,refresh);host.append(controls);
 if(s.busy)host.append(elem('p','Загрузка ставок…','ow-os-hint'));
 if(s.error)host.append(elem('p',s.error,'ow-os-error'));
 if(!s.loaded||!s.bids.length)return;
 const bids=s.bids.filter(b=>key(b)===s.selection);
 // Respect a server-side rejection for SL, role, date, or late submissions.
 const screened=bids.map(b=>s.analysis[b.id]?.eligible===false?{...b,decision:'not_accepted'}:b);
 const scores=scoreOffers(screened,{},new Date().toISOString(),s.analysis);
 const scroll=elem('div',undefined,'ow-os-scroll'),table=elem('table',undefined,'ow-os-table');
 const head=elem('thead'),header=elem('tr');
 ['Перевозчик / вариант','Стоимость и срок','Баллы','Лидеры и категория','Детализация'].forEach(v=>header.append(elem('th',v)));
 head.append(header);table.append(head);
 const tbody=elem('tbody');
 for(const bid of screened){
  const a=scores[bid.id]||{},tr=elem('tr');tr.dataset.level=a.level||'excluded';
  const name=elem('td');name.append(elem('strong',bid.carrier||bid.submitted_email||'Участник'),elem('small','Вариант '+String(bid.variant||bid.id).slice(0,18)));
  const cost=elem('td');cost.append(elem('strong',money(bid.amount)+' '+String(bid.currency||'')),elem('small',String(bid.days||'—')+' дней · '+String(bid.mode||'—')),elem('small',a.priceBasis||''));
  const points=elem('td');points.append(elem('strong',a.score==null?'Вне сравнения':a.score+' / 100','ow-os-score'),elem('small',a.band||''));
  const leaders=elem('td');leaders.append(elem('strong',a.category||'уточнить'));
  for(const tag of a.tags||[])leaders.append(elem('small',tag,'ow-os-tag'));
  if(a.worstFlag)leaders.append(elem('small',a.worstFlag,'ow-os-worst'));
  const notes=elem('td');
  if(a.breakdown){
   const detail=elem('details');detail.append(elem('summary','Баллы по критериям'));
   for(const [k,v] of CRITERIA)detail.append(elem('p',v+': '+a.breakdown[k]+' / '+OFFER_SCORE_WEIGHTS[k]));
   notes.append(detail);
  }
  for(const v of a.notes||[])notes.append(elem('small',v,'ow-os-warning'));
  tr.append(name,cost,points,leaders,notes);tbody.append(tr);
 }
 table.append(tbody);scroll.append(table);host.append(scroll);
 host.append(elem('p','Красная пометка относится к худшей сравнимой ставке; исключённые отображаются отдельно. Ничья не создаёт двух победителей.','ow-os-hint'));
}
let pending=false;
function mount(){
 pending=false;const sect=ownerSection();if(!sect||sect.querySelector('#'+ID))return;
 const panel=elem('section',undefined,'ow-os-panel');panel.id=ID;
 const old=legacy(sect);if(old){old.before(panel);old.classList.add('ow-os-old');}else sect.prepend(panel);
 show();if(!s.loaded&&!s.busy)void load();
}
function schedule(){if(!pending){pending=true;requestAnimationFrame(mount);}}
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);schedule();
