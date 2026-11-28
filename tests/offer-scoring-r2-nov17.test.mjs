import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreOffers,OFFER_SCORE_WEIGHTS,OFFER_SCORE_BANDS} from '../offer-scoring.mjs';
const b={order_code:'WS26098',round_id:'r1',decision:'accepted',mode:'Авто',currency:'USD',weight:'33',amount:5000,days:30,extras:'нет',insurance:'Включено',departure_station:'Ningbo',origin:'Yuyao',destination:'Минск',route:'Yuyao-Manzhouli-Minsk',waypoints:'Маньчжурия—Забайкальск',valid_until:'2026-12-31'};
const run=x=>scoreOffers(x,{},'2026-11-17T12:00:00Z');
test('seven criteria and agreed 100-point scale',()=>{assert.equal(Object.values(OFFER_SCORE_WEIGHTS).reduce((a,c)=>a+c,0),100);assert.deepEqual(OFFER_SCORE_BANDS.map(x=>x.min),[90,80,70,60,35,0]);});
test('one unique balanced recommendation, owner decides',()=>{const x=run([{...b,id:'a'},{...b,id:'b',amount:6100,days:25}]);assert.equal(Object.values(x).filter(z=>z.isBalancedLeader).length,1);assert.equal(x.a.ownerDecisionRequired,true);});
test('cross-currency, transport, weight and rounds never grouped',()=>{const x=run([{...b,id:'a'},{...b,id:'b',currency:'EUR'},{...b,id:'c',mode:'ЖД'},{...b,id:'d',weight:'5'},{...b,id:'e',round_id:'r2'}]);Object.values(x).forEach(y=>assert.equal(y.groupSize,1));});
test('unknown extras are not zero and cannot make dark-green leader',()=>{const x=run([{...b,id:'a',extras:'по согласованию'},{...b,id:'b',amount:6000}]);assert.equal(x.a.extrasKnown,false);assert.equal(x.a.comparableTotal,null);assert.ok(x.a.score<=79);assert.equal(x.a.isBalancedLeader,false);});
test('known surcharges included in cheapest ranking',()=>{const x=run([{...b,id:'a',extras:'2000 USD'},{...b,id:'b',amount:6000}]);assert.equal(x.a.comparableTotal,7000);assert.ok(x.b.tags.some(z=>z.includes('Самая дешёвая')));});
test('unknown weight blocks comparability',()=>{const x=run([{...b,id:'a',weight:''},{...b,id:'b',weight:''}]);assert.equal(x.a.groupSize,1);assert.ok(x.a.score<=69);});
test('insurance not included has no insurance points',()=>{const x=run([{...b,id:'a',insurance:'not included'},{...b,id:'b'}]);assert.equal(x.a.breakdown.insurance,0);assert.equal(x.b.breakdown.insurance,5);});
test('server-denied, rejected or expired offers stay outside scores',()=>{const x=run([{...b,id:'a',decision:'rejected'},{...b,id:'b',valid_until:'2026-11-01'}]);assert.equal(x.a.score,null);assert.equal(x.b.score,null);const y=scoreOffers([{...b,id:'c'}],{},'2026-11-17T12:00:00Z',{c:{quality:'unavailable'}});assert.equal(y.c.eligible,false);});
test('tie never produces two leaders',()=>{const x=run([{...b,id:'a'},{...b,id:'b'}]);assert.equal(x.a.isBalancedLeader,false);assert.equal(x.b.isBalancedLeader,false);assert.equal(x.a.tieForBest,true);});
test('production and test show server-authoritative scoring in actual Owner React offers',()=>{assert.equal(readFileSync(new URL('../offer-scoring.mjs',import.meta.url),'utf8'),readFileSync(new URL('../test/offer-scoring.mjs',import.meta.url),'utf8'));for(const file of ['../app.js','../test/app.js'])assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/analysis:g\.analysis\|\|\{\}/);});

test('Owner UI never reranks the API result with a different browser snapshot or local clock',()=>{for(const file of ['../app.js','../test/app.js']){const source=readFileSync(new URL(file,import.meta.url),'utf8');assert.doesNotMatch(source,/scoreOffersR2\(/);assert.match(source,/Ze\("\/api\/offer-analysis"\)\.then\(g=>\{d&&m\(\{\.\.\.g,analysis:g\.analysis\|\|\{\}/);}});
