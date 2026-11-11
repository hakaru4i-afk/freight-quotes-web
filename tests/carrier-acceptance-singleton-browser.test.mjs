import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const script=readFileSync("test/carrier-acceptance-workflow-20261107.js","utf8");
const markup=`<!doctype html><html lang="ru"><meta charset="utf-8"><body>
<div class="cabinet-app carrier-portal" data-cabinet-role="carrier">
 <main class="cabinet-panel" data-section="carrier-orders">
  <h1>Мои заявки</h1><div class="carrier-requests">Новая заявка</div>
 </main>
</div></body></html>`;

test("carrier acceptance remains a single actionable panel through container rerenders and duplicate injections",{timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   const errors=[];let takeCalls=0,reads=0,processStatus="awaiting_take";
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("https://qa.test/**",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname==="/mock")return route.fulfill({status:200,contentType:"text/html",body:markup});
    if(url.pathname==="/api/task2"){
     if(req.method()==="POST"){
      const data=JSON.parse(req.postData()||"{}");
      if(data.action!=="take"||data.order!=="TR-26-000001")return route.fulfill({status:400,contentType:"application/json",body:'{"ok":false}'});
      takeCalls++;processStatus="in_progress";
      return route.fulfill({status:200,contentType:"application/json",body:'{"ok":true}'});
     }
     reads++;
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({role:"carrier",items:[{order_code:"TR-26-000001",registration_no:"TR-26-000001",bitrix_task:"5316",process_status:processStatus,amount:100,currency:"USD",mode:"rail"}]})});
    }
    return route.abort();
   });
   try{
    await page.goto("https://qa.test/mock#overview",{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:script});
    assert.equal(reads,0,"overview must not preload the acceptance list");
    // React navigation changes history and renders the panel without hashchange.
    await page.evaluate(()=>{history.replaceState(null,"","#carrier-orders");document.querySelector("main").append(document.createElement("div"));});
    const root=page.locator("#carrier-awarded-workflow");
    await page.waitForFunction(()=>document.querySelectorAll("#carrier-awarded-workflow [data-flow-action='take']").length===1,null,{timeout:4000});
    assert.equal(await root.count(),1,"initial mount");
    // React-like hydration: the app starts with the section wrapper and later
    // creates a nested #carrier-orders. The existing root must move, not clone.
    await page.evaluate(()=>{
      const panel=document.querySelector('.cabinet-panel[data-section="carrier-orders"]');
      const inner=document.createElement("div");inner.id="carrier-orders";
      inner.innerHTML='<h2>Мои заявки</h2><div class="carrier-requests">Карточки заявок</div>';
      panel.prepend(inner);
    });
    await page.waitForFunction(()=>document.querySelector('#carrier-orders > #carrier-awarded-workflow'));
    assert.equal(await root.count(),1,"container transition must not create duplicate acceptance cards");
    // Recovery if a prior build left a duplicate node behind.
    await page.evaluate(()=>{
     const extra=document.createElement("section");extra.id="carrier-awarded-workflow";
     extra.innerHTML='<h2>Заявки к исполнению</h2><button data-flow-action="take">Duplicate</button>';
     document.querySelector(".carrier-portal").append(extra);
    });
    await page.waitForFunction(()=>document.querySelectorAll("#carrier-awarded-workflow").length===1);
    assert.equal(await page.locator("#carrier-awarded-workflow [data-flow-action='take']").count(),1,"one acceptance CTA");
    await page.screenshot({path:"carrier-acceptance-singleton-"+viewport.width+".png",fullPage:true});
    await page.evaluate(()=>{location.hash="#overview"});
    await page.evaluate(()=>{location.hash="#carrier-orders"});
    await page.waitForFunction(()=>document.querySelectorAll("#carrier-awarded-workflow [data-flow-action='take']").length===1);
    await page.evaluate(()=>{window.confirm=()=>true});
    await page.locator("#carrier-awarded-workflow [data-flow-action='take']").click();
    await page.waitForFunction(()=>location.hash==="#approved-shipments");
    assert.equal(takeCalls,1,"one acceptance API mutation");
    assert.ok(reads>=2,"load and refresh ran");
    assert.deepEqual(errors,[],"browser errors");
    assert.equal(await page.locator("#carrier-awarded-workflow").count(),1,"post-acceptance no duplicate");
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});
