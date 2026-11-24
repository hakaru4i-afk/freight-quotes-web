import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placeIndex} from '../global-view/route-model.mjs';
const resolver=placeIndex([]);
test('ZBK and RU ZBK locate approximate Zabaykalsk without claiming exact checkpoint',()=>{
 for(const label of ['ZBK','RU ZBK','Погранпереход: ZBK','Забайкальск','Zabaikalsk']){
  const point=resolver(label);
  assert.ok(point,label);
  assert.equal(point.lat,49.65139,label);
  assert.equal(point.lng,117.32694,label);
  assert.equal(point.approximate,true,label);
  assert.equal(point.confirmed,false,label);
  assert.equal(point.precision,'city',label);
 }
});
test('unrelated 3-letter route codes remain unresolved',()=>{
 assert.equal(resolver('ABC'),null);
});
