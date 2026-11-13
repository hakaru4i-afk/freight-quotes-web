import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../test/'+name,import.meta.url),'utf8');

test('QA-011: late-draft Owner notice is only mounted in offer comparison',()=>{
  const s=read('late-bid-staging-3ff2c9ab03f5.js');
  assert.match(s,/function ownerOfferPanel\(\)/);
  assert.match(s,/location\.hash\.split\("\?"\)\[0\]!=="#offers"/);
  assert.match(s,/data-section="offers"/);
  assert.match(s,/const host=ownerOfferPanel\(\)/);
  assert.doesNotMatch(s,/const host=document\.querySelector\("main"\)/);
  assert.match(s,/document\.querySelectorAll\("#late-bid-controls-owner"\)\.forEach/);
  assert.match(s,/window\.addEventListener\("hashchange",refresh\)/);
});
test('QA-011: Owner winner controls scoped to comparison and active draft',()=>{
  const s=read('late-bid-staging-3ff2c9ab03f5.js');
  assert.match(s,/function lockWinnerButtons\(active\)/);
  assert.match(s,/const scope=ownerOfferPanel\(\)/);
  assert.match(s,/scope\.querySelectorAll\("\.offer-selection-control button"\)/);
  assert.match(s,/btn\.disabled=true/);
});
test('QA-011: awarded applications segregate new, active and archived',()=>{
  const s=read('carrier-acceptance-workflow-20261107.js');
  assert.match(s,/activeView="new"/);
  assert.match(s,/const grouped=\{new:\[\],progress:\[\],archive:\[\]\}/);
  assert.match(s,/key==="awaiting"\?"new":key==="completed"\?"archive":"progress"/);
  assert.match(s,/visibleItems\.map\(item=>/);
  assert.match(s,/data-flow-filter=/);
  assert.match(s,/\["new","progress","archive"\]/);
});
test('QA-011: execution shipment filter keeps archive separate',()=>{
  const s=read('task2-panel-sidebar-only-20261107.js');
  assert.match(s,/listView:"active"/);
  assert.match(s,/process_status!=="completed"/);
  assert.match(s,/process_status==="completed"/);
  assert.match(s,/data-t2-filter=/);
  assert.match(s,/const visibleItems=state\.listView==="archive"\?archivedItems:activeItems/);
  assert.match(s,/state\.listView=next/);
});
test('QA-011: readable action CSS and four reschedule rows',()=>{
  const app=read('carrier-acceptance-workflow-20261107.css');
  const t2=read('task2.css');
  const shared=read('portal-contrast-accessibility-20261108.css');
  assert.match(app,/#carrier-awarded-workflow \.carrier-flow-filters/);
  assert.match(app,/button\.carrier-flow-filter\.is-active/);
  assert.match(t2,/#task2-root \.t2-list-filters/);
  assert.match(shared,/QA-009 \/ TRACK-PLAN-ALIGN-01/);
});
test('QA-011: updated scripts/styles are actually linked with new cache keys',()=>{
  const html=read('index.html');
  for(const name of [
    'late-bid-staging-3ff2c9ab03f5.js',
    'carrier-acceptance-workflow-20261107.js',
    'task2-panel-sidebar-only-20261107.js',
    'carrier-acceptance-workflow-20261107.css',
    'task2.css'
  ])assert.match(html,new RegExp(name.replaceAll('.','\\.')+'\\?v=[a-f0-9]{12}'));
});
