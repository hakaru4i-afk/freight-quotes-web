import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const js=readFileSync(new URL('../test/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../test/index.html',import.meta.url),'utf8');
const info=JSON.parse(readFileSync(new URL('../test/build-info.json',import.meta.url),'utf8'));
test('owner edit includes original route if UI hides route input',()=>{
  assert.equal(js.includes('body:JSON.stringify({...A,route:A.route??i.route??"",id:i.id,expected:i})'),true);
  const fields={amount:'6500',currency:'USD'};
  const bid={route:'Origin → Station → Destination',amount:5500};
  const payload={...fields,route:fields.route??bid.route??'',id:'id',expected:bid};
  assert.equal(payload.route,bid.route);assert.equal(payload.amount,'6500');
});
test('staging identity and cache-busting preserved',()=>{
  assert.equal(info.environment,'staging');assert.equal(info.projectRef,'ibclzdkxiozbzmniiygv');
  assert.equal(html.includes('app.js?v='+info.build),true);
  assert.equal(info.stagingPatch.includes('Issue47'),true);
});
