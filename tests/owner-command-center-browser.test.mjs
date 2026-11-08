import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
const base="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const fixture={
 workload:{total:4,requests:3,shipments:2,counts:{incidents:1,deliveries:0},items:[{label:"Рассмотреть ставку",order_code:"WS26180",section:"offers",created:"2026-11-08T09:00:00Z"}]},
 registry:{items:[
  {kind:"request",id:"mock-a",order_code:"WS26180",bitrix_task:"5348",protocol:"TR-26-000001",summary:"Оборудование",state:"new",published:"2026-11-08T08:00:00Z"},
  {kind:"request",id:"mock-b",order_code:"WS26179",bitrix_task:"5371",protocol:"TR-26-000002",summary:"Комплектующие",state:"accepted",published:"2026-11-07T08:00:00Z"},
  {kind:"tender",id:"mock-c",order_code:"WS26140",bitrix_task:"5373",protocol:"TN-26-001",summary:"Тендер",state:"open",published:"2026-11-06T08:00:00Z"}
 ]},
 shipments:{items:[
  {order_code:"WS26180",origin:"Нинбо",destination:"Минск",carrier_name:"Тестовый перевозчик A",transport:"sea",cargo_status:"in_transit"},
  {order_code:"WS26179",origin:"Шэньчжэнь",destination:"Минск",carrier_name:"Тестовый перевозчик B",transport:"rail",cargo_status:"in_transit"}
 ]},
 sl:{policies:[{score:91},{score:64},{score:45}]}
};
const routes=["overview","create-request","request-registry","offers","answers","tender-hub","approved-shipments","winner-chats","transport-claims","incident-journal","supplier-orders","content-tasks","management-reports","carrier-service","sla","site-monitor","team","access-levels","portal-feedback","help"];
async function setup(page,role="owner"){
 await page.goto(base+"?page=login",{waitUntil:"domcontentloaded",timeout:40000});
 await page.waitForFunction(()=>window.lwOwnerCommandVersion==="owner-command-03",{timeout:20000});
 await page.evaluate(({fixture,routes,role})=>{
  const original=window.fetch;
  window.fetch=(input,opts)=>{const name=String(input);
   const data=name.startsWith("/api/workload")?fixture.workload:name.startsWith("/api/registry")?fixture.registry:name.startsWith("/api/shipments")?fixture.shipments:name.startsWith("/api/service-level?overview=1")?fixture.sl:null;
   return data?Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}})):original(input,opts);
  };
  const preview=document.createElement("aside");
  preview.className="test-cabinets lw-preview-compact";
  preview.innerHTML='<div class="cabinet-preview-info"><b>Просмотр кабинетов</b><p>Ваш кабинет владельца</p></div><div class="test-cabinet-actions"><div class="cabinet-role-grid"><button class="btn">Мой кабинет</button><button class="btn">Перевозчик</button><button class="btn">Поставщик</button></div><label class="field">Пользователь для просмотра<select><option>Владелец</option></select></label></div>';
  const fixtureRoot=document.getElementById("root")||document.body;
  for(const existing of [...fixtureRoot.children])existing.style.display="none";
  fixtureRoot.append(preview);
  const app=document.createElement("div");app.className="cabinet-app staff-portal";app.setAttribute("data-cabinet-role",role);
  app.innerHTML='<div class="cabinet-layout"><aside class="cabinet-sidebar"><a class="cabinet-brand" href="#overview"><span>↗</span><div>Маршрут</div></a><div class="cabinet-role">Кабинет владельца</div><nav>'+routes.map(id=>'<a href="#'+id+'"><span>◇</span>'+id+'</a>').join("")+'</nav></aside><div class="cabinet-body"><header class="cabinet-topbar"><div class="bar"><div><small>Кабинет владельца</small><h1>Моя нагрузка</h1></div></div><div class="bar"><span class="cabinet-online"><i></i>Кабинет работает</span><button class="btn secondary" type="button">Выйти</button></div></header><main class="cabinet-content"><div class="cabinet-panel" data-section="overview"><section class="overview-welcome"><h2>Старый экран</h2></section></div></main></div></div>';
  fixtureRoot.append(app);
 },{fixture,routes,role});
}
test("approved Owner dashboard with real-API mock only and responsive visuals",{timeout:240000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const size of [{width:2048,height:1050},{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport:size});const errors=[];page.on("pageerror",e=>errors.push(e.message));
   try{
    await setup(page);
    await page.waitForFunction(()=>document.querySelector("#lw-owner-command .lw-cc-kpi-info strong")?.textContent==="3",{timeout:18000});
    const detail=await page.evaluate(()=>{
     const $=s=>document.querySelector(s);
     const dashboard=$("#lw-owner-command");
     return {
      exists:!!dashboard,visible:!!dashboard&&getComputedStyle(dashboard).display!=="none",
      values:[...dashboard.querySelectorAll(".lw-cc-kpi-info strong")].map(n=>n.textContent.trim()),
      sl:dashboard.querySelector(".lw-cc-sl-donut strong")?.textContent,
      high:dashboard.querySelector(".lw-cc-sl-stat")?.textContent,
      route:dashboard.querySelector(".lw-cc-route-list")?.textContent,
      table:dashboard.querySelector("table")?.textContent,
      sidebar:!!document.querySelector(".lw-owner-nav"),
      shellLeft:document.querySelector('.cabinet-layout')?.getBoundingClientRect().left,
      shellWidth:document.querySelector('.cabinet-layout')?.getBoundingClientRect().width,
      roleHidden:getComputedStyle(document.querySelector(".test-cabinets")).display==="none",
      roleTrigger:!!document.querySelector(".lw-cc-role-trigger"),
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      oldHidden:getComputedStyle($(".overview-welcome")).display==="none",
      hero:dashboard.querySelector(".lw-cc-hero")?.getBoundingClientRect().height,
      links:[...dashboard.querySelectorAll("a[href]")].map(x=>x.getAttribute("href"))
     };
    });
    assert.deepEqual(detail.values,["3","4","1","2","1"],"KPI must reflect actual fixture response");
    assert.equal(detail.sl,"67%","SL average from real scores");
    assert.match(detail.high,/76–100%/);
    assert.match(detail.route,/Нинбо/);
    assert.match(detail.table,/WS26180/);
    assert.equal(detail.sidebar,true);
    assert.equal(detail.oldHidden,true);
    assert.ok(Math.abs(detail.shellLeft)<=2,"Unexpected left layout gutter: "+JSON.stringify(detail));
    assert.ok(Math.abs(detail.shellWidth-size.width)<=8,"Main shell not full-bleed: "+JSON.stringify(detail));
    assert.equal(detail.roleHidden,true,"Large role preview must be collapsed by default");
    assert.equal(detail.roleTrigger,true,"Role preview must be reachable from topbar");
    await page.locator(".lw-cc-role-trigger").click();
    assert.equal(await page.locator(".test-cabinets").evaluate(el=>getComputedStyle(el).display!=="none"),true,"Role panel should open");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".test-cabinets").evaluate(el=>getComputedStyle(el).display==="none"),true,"Escape closes role panel");
    assert.ok(detail.hero>=130);
    assert.ok(detail.overflow<=8,"No horizontal page overflow: "+JSON.stringify(detail));
    assert.ok(detail.links.includes("#carrier-service"));
    await page.locator('[data-lw-cc-tab="shipments"]').click();
    assert.match(await page.locator("#lw-owner-command table").innerText(),/Тестовый перевозчик A/);
    await page.locator('[data-lw-cc-tab="tenders"]').click();
    assert.match(await page.locator("#lw-owner-command table").innerText(),/TN-26-001/);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:"owner-command-center-"+size.width+".png",fullPage:true});
   }finally{await page.close()}
  }
  const page=await browser.newPage({viewport:{width:1180,height:800}});
  try{await setup(page,"carrier");await page.waitForTimeout(350);assert.equal(await page.locator("#lw-owner-command").count(),0,"Carrier must not receive Owner view");}
  finally{await page.close()}
 }finally{await browser.close()}
});
