import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{chromium}from'playwright';
const script=readFileSync('test/ved-single-workspace-20261108.js','utf8');
test('VED label changes preserve React-owned navigation nodes during route updates',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.setContent('<main id="root"><div class="cabinet-app" data-cabinet-role="logistic"><div class="cabinet-role">Кабинет ВЭД</div><aside class="cabinet-sidebar"><nav><a href="#overview">Главная</a><a href="#approved-shipments"><span aria-hidden="true">⌖</span>Мои перевозки<b>›</b></a></nav></aside><section class="cabinet-panel" data-section="overview"></section></div></main>');
  await page.evaluate(()=>{const link=document.querySelector('a[href="#approved-shipments"]');window.owned={link,icon:link.querySelector('span'),label:[...link.childNodes].find(n=>n.nodeType===3),arrow:link.querySelector('b')};});
  await page.addScriptTag({content:script});await page.waitForFunction(()=>document.querySelector('.cabinet-app').dataset.vedWorkspace==='active-shipments-20261108');
  const result=await page.evaluate(()=>{const{link,icon,label,arrow}=window.owned;return{iconRetained:icon.parentNode===link,labelRetained:label.parentNode===link,arrowRetained:arrow.parentNode===link,icon:icon.textContent,label:label.data};});
  assert.deepEqual(result,{iconRetained:true,labelRetained:true,arrowRetained:true,icon:'⌖',label:'Активные перевозки'});
  // React may remove its active-route marker when a different route is selected.
  await page.evaluate(()=>window.owned.link.removeChild(window.owned.arrow));await page.waitForTimeout(50);assert.equal(await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').count(),1);
 }finally{await browser.close();}
});
