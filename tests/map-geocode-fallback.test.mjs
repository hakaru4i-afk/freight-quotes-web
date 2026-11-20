import assert from 'node:assert/strict';
import test from 'node:test';
import { placeIndex, routeModel } from '../test/global-view/route-model.mjs';

const resolve = placeIndex([
  [['Minsk'], 'BY', 53.9, 27.56],
  [['Shenzhen'], 'CN', 22.54, 114.06],
  [['Springfield'], 'US', 39.78, -89.65],
  [['Springfield'], 'US', 42.1, -72.59],
]);

test('known RU/EN/ZH cities and matching ISO country codes remain approximate', () => {
  for (const label of ['Минск', 'Minsk, BY', 'BY, Минск', 'CN，深圳', 'Китай, Шэньчжэнь', '深圳，中国', 'Minsk, Belarus', 'г. Минск']) {
    assert.equal(resolve(label)?.approximate, true, label);
  }
});

test('gazetteer never drops an explicit country or resolves an ambiguous city', () => {
  for (const label of ['Minsk, CN', '深圳, BY', 'Minsk, China', 'Minsk, US', 'Shenzhen, US', 'CN, Minsk', 'Minsk, US, 10 Main Street', 'Minsk, BY, CN', 'US, 深圳', 'Yuyao, Zhejiang 宁波 余姚市, US', 'Springfield, US']) {
    assert.equal(resolve(label), null, label);
  }
});


test('street addresses retain their original text and only a provisional city centre',()=>{
 for(const label of ['Minsk, 10 Main Street','Минск, BY, улица 1']){
  const point=resolve(label);
  assert.equal(point.approximate,true);assert.equal(point.confirmed,false);assert.equal(point.precision,'city');
  const route=routeModel({origin:label,destination:'Shenzhen'},null,resolve);
  assert.equal(route.stops[0].label,label);assert.equal(route.stops[0].position.confirmed,false);
 }
});
