import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync('test/app.js','utf8');
const start=script.indexOf('function V0({order:');
const end=script.indexOf('function z0(',start);
assert.ok(start>=0&&end>start,'Owner request component missing');
const owner=script.slice(start,end);
test('Owner Incoterms code has a distinct editable named place with a 300-char limit',()=>{
 assert.match(owner,/name:"incoterm_place",value:g\.incoterm_place\|\|"",required:!!g\.incoterm/);
 assert.match(owner,/maxLength:300,placeholder:/);
 assert.equal(owner.match(/"incoterm","incoterm_place"\]\.every/g)?.length,2,'Must block incomplete publish in both guards');
});
test('Owner supplier order is independent from substitution order and Bitrix',()=>{
 assert.match(owner,/name:"supplier_order_number",value:g\.supplier_order_number\|\|""/);
 assert.match(owner,/supplier_order_number:S\.target\.value/);
 assert.match(owner,/maxLength:120,placeholder:/);
 assert.match(owner,/"sender_contact","origin","weight","destination","waypoints","cargo","volume","ready_date","incoterm","incoterm_place","supplier_order_number"/);
 assert.match(owner,/body:JSON\.stringify\(\{order:i,summary:y,deadline:w,bitrixTask:c,logistics:g/);
});

test('Carrier shipment panel displays inherited Incoterms and supplier order, without inventing a value',()=>{
 assert.match(script,/className:"logistics-facts"/);
 assert.match(script,/d\.incoterm\?\[d\.incoterm,d\.incoterm_place\]\.filter\(Boolean\)\.join/);
 assert.match(script,/d\.supplier_order_number/);
});
test('New request field labels, descriptions and placeholders have English and Chinese equivalents',()=>{
 for(const phrase of ['Место поставки по Incoterms','Номер заказа поставщика','Номер заказа по проформе поставщика','Условия Incoterms']){
  assert.ok(script.includes(JSON.stringify(phrase)+':['),phrase+' missing translation dictionary');
 }
 assert.ok(script.includes('Supplier order number'));
 assert.ok(script.includes('Incoterms 指定交货地点'));
});
