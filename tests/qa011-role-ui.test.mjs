import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
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


test('QA-012: one shipment stages header with unchanged milestones',()=>{
  const s=read('task2-panel-sidebar-only-20261107.js');
  assert.match(s,/\["stages","Этапы перевозки"\]/);
  assert.doesNotMatch(s, /return '<h3>Этапы перевозки<\/h3><p class="t2-muted">/);
  assert.match(s, /const milestones=\[/);
  assert.match(s, /\["8","Закрытие перевозки"/);
});
test('QA-013: shared chat has readable colors for body, inputs and buttons',()=>{
  const css=read('lw-ved-shared-chat-20261109.css');
  assert.match(css,/QA-013 \/ LW-CONTRAST-ALL/);
  assert.match(css,/\.lw-ved-chat-message p/);
  assert.match(css,/\.lw-ved-chat-layout textarea::placeholder/);
  assert.match(css,/\[data-vc-submit\]:hover/);
});

test('QA-011: Owner request winner actions form one aligned desktop row and stack on mobile',async()=>{
 const html=read('index.html');
 const style=html.match(/<style id="qa011-owner-winner-actions">([\\s\\S]*?)<\\/style>/)?.[1];
 assert.ok(style,'Owner winner action layout must be included in staging HTML');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.setContent('<style>body{margin:0}.cabinet-panel{width:1100px;margin:20px}.notice{padding:16px;background:#eaf5f2;border:1px solid #cee8df;border-radius:11px}</style>'+style+
   '<section class="cabinet-app staff-portal" data-cabinet-role="owner"><div class="cabinet-panel" data-section="request-registry">'+
   '<div class="notice"><strong>Тестовый перевозчик №1 · test.carrier.alpha</strong>'+
   '<button>Чат с исполнителем</button><button>Победитель отказался от исполнения</button><button>Завершение перевозки / подтвердить доставку</button></div>'+
   '<div class="notice"><strong>Тестовый перевозчик №2</strong><div class="winner-actions">'+
   '<button>Чат с исполнителем</button><button>Победитель отказался от исполнения</button><button>Завершение перевозки / подтвердить доставку</button></div></div>'+
   '</div></section>');
  for(const selector of ['.notice:first-child','.winner-actions']){
   const row=page.locator(selector);
   const metrics=await row.evaluate(el=>{const bs=[...el.querySelectorAll(':scope > button')];const rs=bs.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scroll:b.scrollWidth,client:b.clientWidth}});return{display:getComputedStyle(el).display,rs,overflow:el.scrollWidth>el.clientWidth+1};});
   assert.equal(metrics.display,'flex',selector+' must be a flex action row');
   assert.equal(metrics.rs.length,3,selector+' must contain three actions');
   assert.ok(Math.max(...metrics.rs.map(x=>x.y))-Math.min(...metrics.rs.map(x=>x.y))<=1,selector+' desktop buttons must share one row');
   assert.ok(metrics.rs.every(x=>x.height>=44&&x.width>0&&x.scroll<=x.client+1),selector+' buttons must be readable without horizontal overflow');
   assert.equal(metrics.overflow,false,selector+' must not overflow its card');
  }
  await page.setViewportSize({width:390,height:844});
  for(const selector of ['.notice:first-child','.winner-actions']){
   const row=page.locator(selector);const metrics=await row.evaluate(el=>{const bs=[...el.querySelectorAll(':scope > button')];return{width:el.clientWidth,scroll:el.scrollWidth,rs:bs.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scroll:b.scrollWidth,client:b.clientWidth}})};});
   assert.equal(metrics.rs.length,3);
   assert.ok(metrics.scroll<=metrics.width+1,selector+' mobile card must not overflow');
   assert.ok(metrics.rs.every(x=>x.width>=300&&x.scroll<=x.client+1),selector+' mobile actions must use full readable width');
   assert.ok(metrics.rs[0].y<metrics.rs[1].y&&metrics.rs[1].y<metrics.rs[2].y,selector+' mobile actions must stack in order');
  }
 }finally{await browser.close();}
});
