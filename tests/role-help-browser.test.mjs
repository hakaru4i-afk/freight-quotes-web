import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
test("SH-01.30.46 v FAQ menu and role guides for staff at desktop/mobile",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1366,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:768}});
   await page.goto("https://hakaru4i-afk.github.io/freight-quotes-web/test/?page=login",{waitUntil:"domcontentloaded",timeout:45000});
   await page.waitForFunction(()=>window.shRoleHelpVersion==="SH-01.30.46 v",{timeout:20000});
   await page.evaluate(()=>{
    const el=document.createElement("div");el.className="sw-cabinet";el.dataset.cabinetRole="supplier";
    el.innerHTML='<aside class="sw-sidebar"><nav><button type="button">Мои заказы</button><button type="button" aria-current="page">Инструкция / FAQ</button></nav></aside><main class="sw-page"></main>';
    document.querySelector("#root").append(el);
   });
   await page.locator(".sw-cabinet #sh-role-instructions li").first().waitFor({timeout:12000});
   assert.equal(await page.locator(".sw-cabinet #sh-role-instructions li").count(),4);
   assert.match(await page.locator(".sw-cabinet .sw-sidebar nav button").last().innerText(),/FAQ и инструкции по кабинетам/);
   await page.evaluate(()=>document.documentElement.lang="en");
   await page.waitForFunction(()=>document.querySelector('.sw-cabinet #sh-role-instructions')?.dataset.version==="supplier|en",{timeout:10000});
   assert.match(await page.locator(".sw-cabinet #sh-role-instructions h2").innerText(),/FAQ & role instructions/);
   await page.evaluate(()=>document.documentElement.lang="zh-CN");
   await page.waitForFunction(()=>document.querySelector('.sw-cabinet #sh-role-instructions')?.dataset.version==="supplier|zh",{timeout:10000});
   assert.equal(await page.locator(".sw-cabinet #sh-role-instructions li").count(),4);
   await page.close();
  }
 }finally{await browser.close()}
});
