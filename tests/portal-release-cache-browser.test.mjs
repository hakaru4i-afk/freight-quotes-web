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
