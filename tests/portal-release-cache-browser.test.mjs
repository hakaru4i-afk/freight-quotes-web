import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {chromium} from 'playwright';
const source=readFileSync('test/portal-release-status-20261117.js','utf8');
test('content cache digest never masquerades as a business release or creates a false update alert',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [query,version,expected] of [
   ['v=abcdef123456&businessVersion=SH-01.30.59+v','SH-01.30.59 v','hidden'],
   ['v=SH-01.30.59+v','SH-01.30.59 v','hidden'],
   ['v=abcdef123456&businessVersion=SH-01.30.58+v','SH-01.30.59 v','stale'],
   ['v=abcdef123456','SH-01.30.59 v','checking']]){
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://qa.test/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/fixture')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<html lang="ru"><meta charset="utf-8"><body><div id="root"><div class="cabinet-app" data-cabinet-role="carrier"></div></div><script src="/portal-release-status-20261117.js?'+query+'"></script></body></html>'});
    if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript; charset=utf-8',body:source});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'released',version,changes:[]})});
   });
   await page.goto('https://qa.test/fixture',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#lw-release-status').isHidden(),expected==='hidden');
   if(expected==='stale')assert.ok((await page.locator('#lw-release-status').innerText()).includes('Доступна новая версия'));
   if(expected==='checking')assert.ok((await page.locator('#lw-release-status').innerText()).includes('Публикация проверяется'));
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
});


test('role-scoped progress displays title, expected result, status and collapsible bar',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const loggedIn of [true,false]){
   const page=await browser.newPage();const errors=[];let noticeCalls=0;
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://qa.test/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/fixture')return route.fulfill({contentType:'text/html; charset=utf-8',
     body:'<html lang="ru"><meta charset="utf-8"><body><div id="root">'+(loggedIn?'<div class="cabinet-app" data-cabinet-role="carrier"></div>':'')+
      '</div><script src="/portal-release-status-20261117.js?businessVersion=SH-01.30.59+v"></script></body></html>'});
    if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript; charset=utf-8',body:source});
    if(url.pathname==='/api/portal-feedback'){
     noticeCalls++;
     return route.fulfill({contentType:'application/json',
      body:JSON.stringify({ok:true,role:'carrier',items:[{id:'QA-1',title:'Проверка карты перевозчика',
       expectedResult:'Километраж пересчитывается автоматически',stage:4,totalStages:6,percent:67,status:'in_progress'}]})});
    }
    return route.fulfill({contentType:'application/json',
     body:JSON.stringify({status:'released',version:'SH-01.30.59 v',changes:[]})});
   });
   await page.goto('https://qa.test/fixture',{waitUntil:'networkidle'});
   const banner=page.locator('#lw-dev-notices');
   assert.equal(await banner.isVisible(),loggedIn);
   if(loggedIn){
    assert.match(await banner.innerText(),/Проверка карты перевозчика/);
    assert.match(await banner.innerText(),/Километраж пересчитывается автоматически/);
    assert.match(await banner.innerText(),/67%/);
    assert.equal(await banner.getByRole('progressbar').getAttribute('aria-valuenow'),'4');
    await banner.locator('[data-dev-collapse]').click();
    assert.equal(await banner.getByRole('progressbar').count(),0);
    await banner.locator('[data-dev-expand]').click();
    assert.equal(await banner.getByRole('progressbar').count(),1);
   }else assert.equal(noticeCalls,0,'Guests must not request private notices');
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close()}
});


test('Owner sees actual production SH59/SH52 API drift even when the status JSON claims released',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [apiVersion,expectWarning] of [['SH-01.30.52 v',true],['SH-01.30.59 v',false]]){
   const page=await browser.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://hakaru4i-afk.github.io/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/freight-quotes-web/fixture')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<html lang="ru"><body><div id="root"><div class="cabinet-app" data-cabinet-role="owner"></div></div><script src="/freight-quotes-web/portal-release-status-20261117.js?businessVersion=SH-01.30.59+v"></script></body></html>'});
    if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript; charset=utf-8',body:source});
    if(url.pathname.endsWith('release-status.json'))return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'released',version:'SH-01.30.59 v',changes:[]})});
    return route.fulfill({status:404});
   });
   await page.route('https://ooclsrndeygojtofuyte.supabase.co/functions/v1/freight-api/health',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({projectRef:'ooclsrndeygojtofuyte',release:apiVersion,ok:true})}));
   await page.goto('https://hakaru4i-afk.github.io/freight-quotes-web/fixture',{waitUntil:'networkidle'});
   await page.waitForFunction(warning=>document.querySelector('#lw-release-status')?.dataset.state===(warning?'failed':'released'),expectWarning);
   assert.equal(await page.locator('#lw-release-status').isVisible(),expectWarning);
   if(expectWarning){assert.match(await page.locator('#lw-release-status').innerText(),/SH-01\.30\.52 v/);assert.match(await page.locator('#lw-release-status').innerText(),/Обновление требует проверки/);}
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();}
});
