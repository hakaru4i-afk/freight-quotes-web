import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeModel as stagingModel} from '../test/global-view/route-model.mjs';
import {routeModel as productionModel} from '../global-view/route-model.mjs';

// The API Task2 winning SQL returns bids.origin/destination, not destination_station.
test('both loaded Task2 panels pass the actual winner stations to 2D/3D map',()=>{
 for(const path of [
  'task2-panel-sidebar-only-20261107.js',
  'test/task2-panel-sidebar-only-20261107.js',
  'test/task2-panel.js'
 ]){
  const source=readFileSync(path,'utf8');
  assert.match(source,/incoterm_place:o\.incoterm_place,departure_station:o\.origin\|\|o\.departure_station,destination_station:o\.destination\|\|o\.destination_station/);
  assert.doesNotMatch(source,/departure_station:o\.incoterm_place,destination_station:o\.destination_station/);
 }
});

test('both 2D/3D route models preserve separate Incoterms and carrier station points',()=>{
 const owner={origin:'China, Ningbo',destination:'Belarus, Minsk'};
 const carrier={incoterm_place:'China, Yuyao',departure_station:'China, Ningbo station',
  destination_station:'Belarus, Brest station',waypoints:'Kazakhstan, Dostyk'};
 const expected=[owner.origin,carrier.incoterm_place,carrier.departure_station,
  'Kazakhstan, Dostyk',carrier.destination_station,owner.destination];
 for(const model of [stagingModel,productionModel]){
  const route=model(owner,carrier,()=>null);
  assert.deepEqual(route.stops.map(p=>p.label),expected);
  assert.equal(route.markers.length,0,'unconfirmed coordinates must never be invented');
  assert.deepEqual(model(owner,{...carrier,incoterm_place:owner.origin},()=>null).stops.map(p=>p.label),
   [owner.origin,carrier.departure_station,'Kazakhstan, Dostyk',carrier.destination_station,owner.destination],
   'adjacent equal Owner and Incoterms locations must deduplicate');
 }
});
