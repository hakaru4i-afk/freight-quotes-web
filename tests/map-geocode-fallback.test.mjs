import assert from 'node:assert/strict';
import test from 'node:test';
import { placeIndex } from '../test/global-view/route-model.mjs';

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

test('gazetteer rejects mismatched countries and ambiguous same-name settlements', () => {
  for (const label of ['Minsk, CN', '深圳, BY', 'Minsk, China', 'Springfield, US']) {
    assert.equal(resolve(label), null, label);
  }
});

test('mixed street addresses can resolve only to explicitly unverified city centres', () => {
  for (const label of ['Minsk, 10 Main Street', 'Минск, BY, улица 1']) {
    const point = resolve(label);
    assert.ok(point, label + ' should retain its approximate locality');
    assert.equal(point.approximate, true, label);
    assert.equal(point.confirmed, false, label);
    assert.equal(point.precision, 'city', label);
    assert.match(point.source, /gazetteer locality/, label);
    assert.deepEqual([point.lat, point.lng], [53.9, 27.56], label);
  }
});
