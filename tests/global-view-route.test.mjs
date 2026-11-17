import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { placeIndex, routeModel, transportMode } from '../test/global-view/route-model.mjs';

const places = JSON.parse(await readFile(new URL('../test/global-view/places.json', import.meta.url)));
const resolve = placeIndex(places);

test('request and selected offer share one ordered route', () => {
  const route = routeModel({ origin: 'Шэньчжэнь', destination: 'Минск', waypoints: 'Нинбо' },
    { incoterm_place: 'Шэньчжэнь', route: 'Нинбо → Минск', mode: 'Ж/Д' }, resolve);
  assert.deepEqual(route.markers.map(point => point.label), ['Шэньчжэнь','Нинбо','Минск']);
  assert.equal(route.mode, 'rail');
  assert.equal(route.segments.length, 2);
  assert.deepEqual(route.deferred, []);
});

test('unknown waypoint breaks a route, station names and explicit coordinates stay separate', () => {
  const route = routeModel({ origin: 'Китай, Шэньчжэнь, адрес склада', destination: '53.91, 27.62' },
    { incoterm_place: 'Нинбо', route: 'Нет координат этой станции', destination_station: 'Минск', mode: 'Море + Авто' }, resolve);
  assert.equal(route.mode, 'multi');
  assert.equal(route.stops[2].position, null);
  assert.equal(route.segments.length, 2); // city fallback now connects the first leg
  assert.ok(route.stops[0].position, "A recognizable city must provide a preliminary automatic point");
  assert.equal(route.stops[0].position.approximate, true);
  assert.equal(route.stops[0].position.confirmed, false);
  assert.equal(route.stops.at(-1).position.approximate, false);
});

test('all supported transport modes are classified', () => {
  assert.deepEqual(['ЖД', 'Авто', 'Море', 'Авиа', 'Мультимодальный', ''].map(transportMode),
    ['rail', 'road', 'sea', 'air', 'multi', 'unknown']);
});

test('unsequenced waypoints stay visible without changing the selected route', () => {
  const route = routeModel({ origin: 'Шэньчжэнь', destination: 'Минск', waypoints: 'Москва' },
    { waypoints: 'Сиань → Алматы', route: 'Сиань → Алматы → Варшава', mode: 'Ж/Д' }, resolve);
  assert.deepEqual(route.stops.map(stop => stop.label), ['Шэньчжэнь', 'Сиань', 'Алматы', 'Минск']);
  assert.deepEqual(route.deferred.map(stop => stop.label), ['Москва', 'Варшава']);
  assert.equal(route.markers.length, 6);
  assert.equal(route.segments.length, 3);
});

test('WS26098: Yuyao Zhejiang pickup is located without manually entered coordinates', async () => {
  const pickup = 'NINGBO Zhejiang Yuyao 浙江省余姚市马渚镇北盛路';
  const route = routeModel({origin:pickup,destination:'Минск'},null,resolve);
  assert.equal(route.stops.length,2);
  assert.ok(route.stops[0].position,'Yuyao must have a provisional city-centre position');
  assert.equal(route.stops[0].position.precision,'city');
  assert.equal(route.stops[0].position.confirmed,false);
  assert.ok(Math.abs(route.stops[0].position.lat-30.0403)<0.00001);
  assert.ok(Math.abs(route.stops[0].position.lng-121.1501)<0.00001);
  assert.equal(route.markers.length,2);
  assert.equal(route.segments.length,1);
  const {calculateMapDistances} = await import('../test/global-view/distance.mjs');
  const result = await calculateMapDistances(route,{
    fetchImpl:async()=>{throw Error('router offline')}
  });
  assert.ok(result.totalKm>0,'A preliminary geographical lower bound must be shown even offline');
  assert.equal(result.geodesicMinimum,true,'A straight line is not a transport route');
});

test('Never substitute Yuyao for unrelated locations or verified factory coordinates', () => {
  const ningbo=resolve('NINGBO Zhejiang warehouse without address');
  assert.ok(ningbo, 'Known parent city may be used as a labelled preview');
  assert.equal(ningbo.approximate,true);
  assert.notEqual(ningbo.lat,30.0403,'Ningbo cannot masquerade as Yuyao');
  assert.equal(resolve('Чжэцзян, неизвестный склад'),null);
  assert.equal(resolve('30.0743889, 121.0452108').approximate,false);
});

test('generic mixed-language locality parser works without per-order hardcoded routes', () => {
  const cases = [
    ['Shenzhen Guangdong China warehouse address','Shenzhen'],
    ['QINGDAO Linyi shandong 山东省临沂市费县梁丘镇郝家村','Linyi'],
    ['NINGBO Zhejiang Yuyao 浙江省余姚市马渚镇北盛路','Yuyao'],
    ['浙江省宁波市余姚市马渚镇北盛路','Yuyao'],
    ['Китай, Шэньчжэнь, адрес склада','Shenzhen']
  ];
  for (const [input,city] of cases) {
    const position=resolve(input);
    assert.ok(position, input+' should resolve city centre');
    assert.equal(position.approximate,true);
    assert.equal(position.confirmed,false);
    assert.equal(position.precision,'city');
  }
  assert.equal(resolve('неизвестный склад неизвестный город'),null);
});
