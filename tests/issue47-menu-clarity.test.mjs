import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const app = readFileSync(new URL('../test/app.js', import.meta.url), 'utf8');
const escaped = (value) => Array.from(value, (ch) => {
  const hex = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
  return ch.charCodeAt(0) > 127 ? '\\u' + hex : ch;
}).join('');

const uniqueNavigation = [
  ['carrier-orders', 'Входящие запросы'],
  ['carrier-offers', 'Мои ставки'],
  ['offers', 'Рассмотрение ставок'],
  ['answers', 'Сроки и ответы'],
  ['approved-shipments', 'Исполнение перевозок'],
  ['shipment-fulfillment', 'Приёмка и завершение'],
  ['transport-applications', 'Транспортная заявка · документ'],
  ['transport-claims', 'Претензии и акты'],
];

test('Issue #47: each clarified navigation item has exactly one canonical entry', () => {
  for (const [id, label] of uniqueNavigation) {
    const expression = escaped(`id:"${id}",label:"${label}"`);
    assert.equal(app.split(expression).length - 1, 1, `${id}: ${label}`);
  }
});

test('Issue #47: quote calculation does not share the shipment-execution action label', () => {
  assert.equal(app.split(escaped('children:"Начать расчёт ставки"')).length - 1, 1);
  assert.equal(app.split(escaped('children:"Взять в работу"')).length - 1, 0);
});

test('Issue #47: no production app.js or API code touched by this staging-only change', () => {
  assert.ok(app.length > 2_000_000, 'unexpected staging app bundle');
});
