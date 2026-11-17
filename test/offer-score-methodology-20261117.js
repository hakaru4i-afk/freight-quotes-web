/* OFFER-EVAL-20261117-R2 · Owner only. Replaces obsolete four-colour prose, not application data or winner actions. */
(()=>{'use strict';
const criteria=[
 ['Цена','25','Сравнивается полная подтверждённая стоимость в одной валюте; неизвестные доплаты не считаются нулём'],
 ['Срок доставки','20','Дней до конечного пункта; одинаковая точка отсчёта и подтверждённые условия'],
 ['Станция / порт отправления','10','Точное название, подходящий вид транспорта, отличие станции от города'],
 ['Маршрут','15','Погрузка, промежуточные пункты, перегрузки, место назначения и логика следования'],
 ['Пограничные переходы','15','Указан конкретный переход и соответствие авто/ЖД; задержки не выдумываются'],
 ['Дополнительные расходы','10','Перегрузка, терминалы, ПТО, простой, документы, доплаты и их валюты'],
 ['Страхование и условия','5','Включено ли покрытие в цену, ограничения и франшиза']
];
const bands=[
 ['90–100','Тёмно-зелёный','сильное подтверждённое предложение'],
 ['80–89','Зелёный','выгодная альтернатива'],
 ['70–79','Светло-зелёный','сопоставимый вариант'],
 ['60–69','Жёлтый','нужно уточнение'],
 ['0–59','Оранжевый','существенные недостатки либо риски'],
 ['—','Серый / красный','несопоставимый / недопущенный (причина обязательна)']
];
const root=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"],.staff-portal[data-cabinet-role="owner"]');
function add(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function panel(){
 const section=add('section','offer-methodology-r2');
 section.setAttribute('aria-label','Критерии оценки ставок');
 section.dataset.methodologyVersion='OFFER-SCORE-20261117-R2';
 section.append(add('h3','','Расширенная оценка предложений · 100 баллов'));
 section.append(add('p','','Оценка учитывает семь критериев. Лучшее по цене, самое быстрое и наиболее сбалансированное предложение — разные категории. Лидер по совокупной оценке может быть только один; при равенстве требуется решение владельца или конкурс.'));
 const disclosure=add('details','offer-methodology-details');disclosure.open=true;
 disclosure.append(add('summary','','Критерии, баллы и проверка условий'));
 const table=add('table','offer-methodology-table');
 const header=document.createElement('thead'),headrow=document.createElement('tr');
 ['Критерий','Максимум','Что проверяется'].forEach(x=>headrow.append(add('th','',x)));header.append(headrow);table.append(header);
 const body=document.createElement('tbody');
 criteria.forEach(([name,score,detail])=>{const tr=document.createElement('tr');[name,score,detail].forEach(x=>tr.append(add('td','',x)));body.append(tr);});table.append(body);disclosure.append(table);
 const warning=add('p','offer-methodology-note','Ставки сравниваются только внутри одного заказа/раунда при одинаковых валюте, виде транспорта и весе. Без автоматической конвертации. Неизвестные доплаты, станция, страховка и погранпереход — риск, а не подтверждённое преимущество.');disclosure.append(warning);
 const legend=add('div','offer-methodology-bands');bands.forEach(([score,color,meaning],i)=>{const line=add('div','offer-methodology-band band-'+i);line.append(add('strong','',score),add('span','',color),add('small','',meaning));legend.append(line);});disclosure.append(legend);
 disclosure.append(add('p','offer-methodology-owner','Цвет и баллы — рекомендации, не автоматическое назначение победителя. Недопущенные, просроченные без решения владельца, заблокированные и истёкшие ставки исключаются из рейтинга. Недостаток исходных данных отмечается явно.'));
 section.append(disclosure);return section;
}
function attach(){
 const app=root();if(!app)return;
 const legacy=[...app.querySelectorAll('.offer-legend')];
 for(const p of legacy){
  if(!p.textContent.includes('КРИТЕРИИ СОПОСТАВЛЕНИЯ'))continue;
  if(p.dataset.offerMethodologyReplaced==='1')continue;
  p.dataset.offerMethodologyReplaced='1';
  p.setAttribute('aria-hidden','true');
  p.classList.add('offer-methodology-legacy-hidden');
  if(!p.nextElementSibling?.matches('.offer-methodology-r2'))p.after(panel());
 }
}
let pending=false;
new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;attach();});}).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();
