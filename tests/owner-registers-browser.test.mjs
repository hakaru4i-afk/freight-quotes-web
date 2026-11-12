import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
const url="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const api="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/partner-inquiries";
test("Owner menu DOM integration: five distinct screens, error handling and real anonymous denial",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const size of [{width:1366,height:768},{width:390,height:844}]){
   const page=await browser.newPage({viewport:size});
   await page.route('**/owner-registers-20261111.js*',r=>r.fulfill({path:'test/owner-registers-20261111.js',contentType:'text/javascript'}));
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(url+"?page=login&owqa=01112026",{waitUntil:"domcontentloaded",timeout:45000});
   await page.waitForFunction(()=>window.owOwnerRegistersVersion==="OW-01.30.47 v",{timeout:20000});
   await page.evaluate(()=>{
    const fixture=document.createElement("section");fixture.className="cabinet-app staff-portal";fixture.dataset.cabinetRole="owner";
    fixture.innerHTML='<div class="cabinet-layout"><aside class="cabinet-sidebar mobile-open"><nav class="lw-owner-nav">'+
     '<a href="#overview"><span>◉</span>Главная</a><a href="#portal-feedback"><span>✎</span>Центр доработок</a>'+
     '<a href="#help"><span>?</span>Помощь / FAQ</a></nav></aside>'+
     '<main class="cabinet-content"><div class="cabinet-panel" data-section="overview"><div class="overview-welcome">Главная</div></div>'+
     '<section id="portal-feedback-root"></section></main></div>';
    document.getElementById("root").append(fixture);
   });
   const nav=page.locator('.cabinet-app[data-cabinet-role="owner"] [data-ow-register]');
   await page.waitForFunction(()=>document.querySelectorAll('.cabinet-app[data-cabinet-role="owner"] a[data-ow-register]').length===5,{timeout:16000});
   assert.equal(await nav.count(),5);
   assert.match(await page.locator('.cabinet-app[data-cabinet-role="owner"] .cabinet-sidebar nav a[href="#help"]').innerText(),/FAQ и инструкции/);
   await page.locator('[data-ow-register="updates"]').click();
   await page.waitForFunction(id=>document.querySelector('#ow-workspace')?.dataset.archiveName===id,'updates');
   await page.locator("#ow-workspace").waitFor({timeout:12000});
   assert.match(await page.locator("#ow-workspace h2").innerText(),/Реестр обновлений/);
   await page.locator('[data-ow-register="remarks"]').click();
   await page.waitForFunction(id=>document.querySelector('#ow-workspace')?.dataset.archiveName===id,'remarks');
   assert.match(await page.locator("#ow-workspace h2").innerText(),/Реестр замечаний/);
   await page.locator('[data-ow-register="developments"]').click();
   await page.waitForFunction(id=>document.querySelector('#ow-workspace')?.dataset.archiveName===id,'developments');
   assert.match(await page.locator("#ow-workspace h2").innerText(),/Реестр разработок/);
   await page.locator('[data-ow-register="process"]').click();
   await page.locator('#ow-process-editor').waitFor({timeout:12000});
   assert.equal(await page.locator('#ow-process-frame').count(),0,'Editor replaces the old iframe viewer');
   await page.locator('[data-ow-register="cooperation"]').click();await page.locator('#ow-cooperation-screen').waitFor();
   assert.match(await page.locator('[data-ow-register="cooperation"]').getAttribute("aria-current"),/page/);
   await page.screenshot({path:"ow-registers-"+size.width+".png",fullPage:true});
   assert.deepEqual(errors.filter(e=>!e.includes("NetworkError")),[],"Browser runtime errors");
   await page.close();
  }
  const ctx=await browser.newContext();
  const anon=await ctx.request.get(api,{timeout:20000});
  assert.ok([401,403].includes(anon.status()),"unauthorized partner register is accessible: "+anon.status());
  await ctx.close();
 }finally{await browser.close()}
});
