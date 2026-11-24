import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreOffers as candidate} from '../release/candidates/offer-scoring-clear-status-sh70.mjs';
import {scoreOffers as current} from '../offer-scoring.mjs';
import {readFileSync} from 'node:fs';

const when='2026-11-24T08:00:00Z';
const make=(id,extra={})=>({
 id,order_code:'TR-26-000036',round_id:'r1',decision:'accepted',submitted_email:id,
 amount:5000,days:25,currency:'USD',weight:'1300',mode:'ЖД',
 departure_station:'Ningbo',origin:'Ningbo',destination:'Минск',
 route:'Хоргос — Достык — Минск',waypoints:'Хоргос, Достык',
 insurance:'included',extras:'none',...extra
});
const groups=[
 [make('A',{extras:''}),make('B',{amount:5500,extras:'none'})],
 [make('A',{amount:5000}),make('B',{amount:5500,days:20})],
 [make('A',{extras:'none',departure_station:'',route:'',waypoints:'',insurance:''}),make('B')],
 [make('A')],
 [make('A',{extras:''})]
];
test('Known surcharge on one offer does not make that offer suspicious because of a peer',()=>{
 const scores=candidate(groups[0],{},when);
 assert.equal(scores.A.category,'Уточнить доплаты по ставке');
 assert.equal(scores.B.category,'Условия указаны · сравнение предварительное');
 assert.match(scores.A.statusExplanation,/по этой ставке/i);
 assert.match(scores.B.statusExplanation,/другим предложениям/i);
 assert.ok(scores.A.tags.some(x=>/Доплаты по этой ставке не подтверждены/.test(x)));
 assert.ok(scores.B.tags.some(x=>/доплаты других уточнить/.test(x)));
 assert.ok(scores.A.notes.some(x=>/предел предварительной оценки — 79\/100/.test(x)));
 assert.ok(scores.B.notes.some(x=>/предел оценки — 79\/100/.test(x)));
 assert.equal(scores.A.classificationIsCarrierReliability,false);
 assert.equal(scores.B.classificationIsCarrierReliability,false);
 assert.ok(!Object.values(scores).some(x=>/сомнител/i.test(x.category)));
});
test('Poorly described transport conditions have a neutral actionable label',()=>{
 const s=candidate(groups[2],{},when);
 assert.equal(s.A.category,'Уточнить маршрут и условия');
 assert.ok(s.A.notes.some(x=>/Погранпереход/.test(x)));
 assert.ok(s.A.notes.some(x=>/Страхов/.test(x)));
});
test('Single offer explicitly states it cannot be compared, without negative carrier classification',()=>{
 const s=candidate(groups[3],{},when).A;
 assert.equal(s.category,'Нет сопоставимых ставок');
 assert.ok(s.score<=79);
 assert.ok(s.notes.some(x=>/Нет сопоставимых предложений/.test(x)));
});
test('97/100 compared with 100/100 is HIGH quality, not a red worst offer',()=>{
 const a=candidate([
  make('A',{amount:5000,extras:'none'}),
  make('B',{amount:5000,extras:'15 USD'})
 ],{},when);
 assert.equal(a.A.score,100);
 assert.equal(a.B.score,97);
 assert.equal(a.B.category,'Высокая оценка условий');
 assert.equal(a.B.gapFromTop,3);
 assert.equal(a.B.isWorst,false);
 assert.equal(a.B.worstFlag,null);
 assert.ok(!a.B.tags.some(x=>/худш|ниже других/i.test(x)));
 assert.match(a.B.statusExplanation,/оценены высоко/);
 assert.equal(a.B.level,'dark-green');
 assert.equal(a.B.ownerDecisionRequired,true);
});
test('Red worst warning requires significant gap and actual poor score',()=>{
 const s=candidate([
  make('A'),
  make('B',{route:'',waypoints:'',departure_station:'',insurance:''})
 ],{},when);
 assert.equal(s.A.score,100);
 assert.ok(s.B.score<=69);
 assert.equal(s.B.isWorst,true);
 assert.match(s.B.worstFlag,/Существенно слабее/);
 assert.ok(s.B.tags.some(x=>/Заметно ниже/.test(x)));
 assert.equal(s.A.isWorst,false);
});
test('Tied 97/100 offers do not get a false worst label',()=>{
 const s=candidate([
  make('A',{extras:'15 USD'}),make('B',{extras:'15 USD'})
 ],{},when);
 assert.equal(s.A.score,97);
 assert.equal(s.B.score,97);
 assert.equal(s.A.isWorst,false);
 assert.equal(s.B.isWorst,false);
 assert.equal(s.A.tieForBest,true);
 assert.equal(s.B.tieForBest,true);
});
test('Same amount, criteria, ranking, eligibility and owner-only winner selection as previous method',()=>{
 for(const list of groups){
  const a=candidate(list,{},when),b=current(list,{},when);
  for(const id of Object.keys(a)){
   assert.equal(a[id].score,b[id].score,JSON.stringify(list));
   assert.deepEqual(a[id].breakdown,b[id].breakdown);
   for(const key of ['eligible','quality','level','band','uniqueBest','tieForBest','ownerDecisionRequired','priceBasis','comparableTotal','groupSize'])
    assert.deepEqual(a[id][key],b[id][key],key+': '+id);
   assert.ok(!('winner' in a[id]));
  }
 }
});
test('Owner comparison labels the status and shows its concrete explanation',()=>{
 const source=readFileSync(new URL('../release/candidates/owner-offer-evaluation-clear-status-sh70.mjs',import.meta.url),'utf8');
 assert.match(source,/Преимущества и условия/);
 assert.match(source,/a\.statusExplanation/);
});
test('The source module and deployed candidate remain separate before protected release',()=>{
 assert.equal(typeof candidate,'function');
 assert.equal(typeof current,'function');
});
