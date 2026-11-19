import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placeIndex,routeModel} from '../test/global-view/route-model.mjs';
import {calculateMapDistances} from '../test/global-view/distance.mjs';

const lookup=placeIndex(JSON.parse(readFileSync(new URL('../test/global-view/places.json',import.meta.url),'utf8')));
const origin='QINGDAO Linyi shandong 山东省临沂市费县梁丘镇郝家村';
const request={origin,destination:'Минск'};
const router=async()=>({ok:true,json:async()=>({code:'Ok',routes:[{distance:5623400}]})});

test('WS26122: two Owner addresses produce two automatic city-center points without a carrier',async()=>{
 const route=routeModel(request,null,lookup);
 assert.equal(route.stops.length,2);
 assert.ok(route.stops.every(x=>x.position&&x.position.approximate));
 assert.equal(route.stops[0].label,origin);
 assert.equal(route.stops[0].position.lat>34&&route.stops[0].position.lat<36,true);
 const result=await calculateMapDistances(route,{fetchImpl:router});
 assert.equal(result.status,'provisional');
 assert.equal(result.totalKm,5623.4);
 assert.equal(result.provisionalMode,true);
 assert.equal(result.estimated,true);
});

test('Station supplied by carrier adds third point and forces a new calculation',async()=>{
 const initial=routeModel(request,null,lookup);
 const withCarrier=routeModel(request,{departure_station:'Qingdao'},lookup);
 assert.equal(initial.stops.length,2);
 assert.equal(withCarrier.stops.length,3);
 assert.deepEqual(withCarrier.stops.map(p=>p.label),[origin,'Qingdao','Минск']);
 assert.ok(withCarrier.stops.every(p=>p.position));
 let called=0;
 const result=await calculateMapDistances(withCarrier,{fetchImpl:async()=>{called++;return router()}});
 assert.equal(called,2);
 assert.equal(result.status,'provisional');
 assert.equal(result.totalKm,11246.8);
 assert.equal(result.estimated,true);
});

test('Rail shipment never presents road OSRM as rail kilometer result',async()=>{
 const rail=routeModel(request,{mode:'ЖД'},lookup);
 let calls=0;const result=await calculateMapDistances(rail,{fetchImpl:async()=>{calls++;return router()}});
 assert.equal(calls,0);
 assert.equal(result.geodesicMinimum,true);
 assert.equal(result.status,'provisional');
 assert.ok(result.totalKm>0);
 assert.match(result.source,/Geographical lower bound/);
});

test('private and unverified coordinate pairs never leave the browser for public OSRM',async()=>{
 for(const scope of ['configured-private',undefined]){
  const route=routeModel(request,{mode:'Авто'},lookup);
  route.stops[0].position={...route.stops[0].position,queryScope:scope};
  const result=await calculateMapDistances(route,{fetchImpl:()=>assert.fail('private point must not leave the portal')});
  assert.equal(result.status,'provisional');
  assert.equal(result.geodesicMinimum,true);
  assert.equal(result.legs[0].reason,'PRIVATE_ROUTER_REQUIRED');
 }
});
