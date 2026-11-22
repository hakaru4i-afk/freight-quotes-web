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

test('gazetteer does not discard a mismatched country or unverified address', () => {
  for (const label of ['Minsk, CN', '深圳, BY', 'Minsk, China', 'Minsk, 10 Main Street', 'Минск, BY, улица 1', 'Springfield, US']) {
    assert.equal(resolve(label), null, label);
  }
});
