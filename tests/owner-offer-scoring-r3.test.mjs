import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {scoreOffers,OFFER_SCORE_WEIGHTS,OFFER_SCORE_BANDS} from '../offer-scoring.mjs';

const make=(id,extra={})=>({
 id,order_code:'WS26122',round_id:'r1',decision:'accepted',submitted_email:id,
 amount:5000,days:30,currency:'USD',weight:'1300',mode:'ЖД',
 departure_station:'Ningbo',origin:'Yuyao',destination:'Минск',
 route:'Хоргос - Достык - Минск',waypoints:'Хоргос, Достык',
 insurance:'included',extras:'none',...extra
});
const at='2026-11-17T14:00:00Z';
test('Seven criteria sum to 100 with agreed bands',()=>{
 assert.deepEqual(Object.values(OFFER_SCORE_WEIGHTS),[25,20,10,15,15,10,5]);
 assert.equal(Object.values(OFFER_SCORE_WEIGHTS).reduce((a,b)=>a+b),100);
 assert.deepEqual(OFFER_SCORE_BANDS.map(x=>x.min),[90,80,70,60,35,0]);
});
test('Different currencies, rounds, transport and weights are never ranked together',()=>{
 for(const extra of [{currency:'CNY'},{round_id:'r2'},{mode:'Авто'},{weight:'1600'}]){
  const result=scoreOffers([make('A'),make('B',extra)],{},at);
  for(const s of Object.values(result)){
   assert.equal(s.comparable,false);
   assert.equal(s.uniqueBest,false);
   assert.ok(s.score<=79);
   assert.equal(s.tags.length,0);
  }
 }
});
test('Missing extras cap the whole comparison and do not invent a winner',()=>{
 const result=scoreOffers([make('A',{extras:''}),make('B',{amount:6000})],{},at);
 assert.equal(result.A.score,79);
 assert.equal(result.B.score,79);
 assert.equal(result.A.uniqueBest,false);
 assert.equal(result.B.uniqueBest,false);
 assert.equal(result.A.category,'сомнительная');
 assert.ok(result.A.tags.some(x=>/доплат/i.test(x)));
});
test('Blocked, late unapproved, and expired bids are excluded',()=>{
 const bids=[
  make('A',{decision:'pending'}),make('B',{valid_until:'2026-11-16'}),
  make('C'),make('D',{decision:'accepted'})];
 const r=scoreOffers(bids,{D:{blocked:true}},at);
 for(const id of ['A','B','D']){assert.equal(r[id].eligible,false);assert.equal(r[id].score,null);}
 assert.equal(r.C.eligible,true);
});
test('Specific station, route, border, and conditions leaders require proof',()=>{
 const result=scoreOffers([
  make('A',{route:'',waypoints:'',departure_station:'',insurance:'',amount:4500,days:35}),
  make('B',{amount:5000,days:25})
 ],{},at);
 assert.ok(result.B.tags.some(x=>/станц/i.test(x)));
 assert.ok(result.B.tags.some(x=>/маршрут/i.test(x)));
 assert.ok(result.B.tags.some(x=>/погран/i.test(x)));
 assert.ok(result.B.tags.some(x=>/быстра/i.test(x)));
 assert.ok(result.A.notes.some(x=>/маршрут/i.test(x)));
});
test('No automatic winner and no duplicate best offer on a tie',()=>{
 const r=scoreOffers([make('A'),make('B')],{},at);
 assert.equal(r.A.isBalancedLeader,false);
 assert.equal(r.B.isBalancedLeader,false);
 assert.equal(r.A.uniqueBest,false);
 assert.equal(r.B.uniqueBest,false);
 assert.ok(r.A.tieForBest&&r.B.tieForBest);
 assert.ok(!('winner' in r.A));
});
test('Production and test use the integrated Owner React offer cards, no duplicate comparison table',()=>{
  assert.equal(readFileSync(new URL('../offer-scoring.mjs',import.meta.url),'utf8'),readFileSync(new URL('../test/offer-scoring.mjs',import.meta.url),'utf8'));
  const a=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const b=readFileSync(new URL('../test/index.html',import.meta.url),'utf8');
  for(const html of [a,b]){
    // Exact staging cache keys follow the Git blob, whereas the published baseline
    // can retain its reviewed named R3 cache key until the gated production release.
    assert.match(html,/app\.js\?v=[a-z0-9-]{12,48}/);
    assert.doesNotMatch(html,/owner-offer-evaluation-20261117\.mjs\?v=/);
    assert.doesNotMatch(html,/owner-offer-evaluation-20261117\.css\?v=/);
  }
  // Git provides the exact staged bundle identity for the cache key.
  const stagedBlob=execFileSync('git',['hash-object','test/app.js'],{encoding:'utf8'}).trim();
  assert.ok(b.includes('app.js?v='+stagedBlob.slice(0,12)),'Staging app cache must be pinned to its exact source bytes');
  const scripts=['../app.js','../test/app.js'].map(f=>readFileSync(new URL(f,import.meta.url),'utf8'));
  for(const src of scripts){
    assert.match(src,/offer-scoring\.mjs\?v=offer-r3-20261117-verified/);
    assert.match(src,/КРИТЕРИИ СОПОСТАВЛЕНИЯ · 100 БАЛЛОВ/);
    assert.match(src,/Открыть расшифровку 7 критериев/);
    assert.match(src,/Равные оценки не означают двух победителей/);
  }
});
