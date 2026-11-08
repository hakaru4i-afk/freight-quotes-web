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
  assert.equal(route.segments.length, 2);
  assert.equal(route.stops[0].position.approximate, true);
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
