
import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const html=[
'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
'<link rel="stylesheet" href="/test/style.css"><link rel="stylesheet" href="/test/carrier-dashboard-compact-20261107.css">',
'<link rel="stylesheet" href="/test/lw2-staging-20261107.css"><link rel="stylesheet" href="/test/carrier-defer-transport-application-20261107.css"></head><body>',
'<div class="cabinet-app carrier-portal" data-cabinet-role="carrier"><div class="cabinet-layout">',
'<aside class="cabinet-sidebar"><nav><a href="#overview">Главная</a><a href="#carrier-orders">Мои заявки</a>',
'<a href="#transport-applications">Транспортные заявки</a><a href="#approved-shipments">Исполнение перевозок</a>',
'<a href="#portal-feedback">Предложения</a></nav></aside>',
'<div class="cabinet-body"><header class="cabinet-topbar">Главная</header><main class="cabinet-content">',
'<div class="cabinet-panel" data-section="overview"><section class="overview-welcome"><div>',
'<div class="eyebrow">Ваш рабочий день</div><h2>Ближе к грузу.<br><em>Проще в работе.</em></h2>',
'<p>Давайте ставки по новым заявкам</p><a class="btn" href="#carrier-orders">Открыть</a></div>',
'<div class="overview-orbit"><span>Service Level</span><strong>92<small>/100</small></strong><small>Обычный режим</small></div>',
'</section><div class="overview-metrics"><a class="overview-metric" href="#carrier-orders"><span>Непрочитанных заявок</span>',
'<strong>3</strong><small>Открыть</small></a></div><section class="overview-card"><h2>Ближайшие сроки и действия</h2></section>',
'</div></main></div></div></div><script defer src="/test/lw2-staging-20261107.js"></script><script defer src="/test/carrier-defer-transport-application-20261107.js"></script></body></html>'
].join("");
const rows=[
 {order_code:"TR-26-000101",mode:"Авто",process_status:"in_progress"},
 {order_code:"TR-26-000102",mode:"Ж/Д",process_status:"in_progress"},
 {order_code:"TR-26-000103",mode:"Море",process_status:"in_progress"},
 {order_code:"TR-26-000104",mode:"Авиа",process_status:"in_progress"}
];
const mime={".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml"};
const serve=(req,res)=>{
 const url=new URL(req.url,"http://localhost");
 if(url.pathname==="/fixture"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(html);return;}
 if(url.pathname==="/api/task2"){
  res.writeHead(200,{"Content-Type":"application/json"});
  const id=url.searchParams.get("order");
  res.end(JSON.stringify(id?{state:{status:"in_progress",actual_departure:id.endsWith("101")||id.endsWith("103")?"2026-11-07":null}}:{role:"carrier",items:rows}));return;
 }
 const file=path.resolve("."+url.pathname);
 if(!file.startsWith(path.resolve("test")+path.sep)){res.writeHead(404);res.end();return;}
 readFile(file).then(data=>{res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});res.end(data);}).catch(()=>{res.writeHead(404);res.end();});
};
test("LW2 appears on carrier overview with functional widgets and mobile layout",async()=>{
 const server=createServer(serve);
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const host="http://127.0.0.1:"+server.address().port;
  await page.goto(host+"/fixture",{waitUntil:"networkidle"});
  await page.locator("#lw2-dashboard .lw2-type").first().waitFor({timeout:10000});
  assert.equal(await page.locator(".overview-welcome").getAttribute("data-lw2-hero"),"");
  assert.equal(await page.locator("#lw2-dashboard .lw2-kpi").count(),4);
  assert.equal(await page.locator("#lw2-dashboard .lw2-type").count(),4);
  assert.equal(await page.locator('a[href="#transport-applications"]').evaluate(el=>getComputedStyle(el).display),"none");
  assert.ok(!(await page.locator("#lw2-dashboard .lw2-kpis").innerText()).includes("Транспортные заявки"));
  assert.ok((await page.locator("#lw2-dashboard .lw2-kpis").innerText()).includes("Ожидают ставки"));
  assert.equal(await page.locator("#lw2-dashboard .lw2-donut .lw2-hole strong").textContent(),"4");
  assert.equal(await page.locator("#lw2-dashboard .lw2-kpi").nth(2).locator("strong").textContent(),"2");
  assert.equal(await page.locator(".overview-metrics").evaluate(el=>getComputedStyle(el).display),"none");
  const banner=await page.locator(".overview-welcome").evaluate(el=>getComputedStyle(el,"::before").backgroundImage);
  assert.ok(banner.includes("lw2-hero-20261107.svg"),banner);
  assert.equal(await page.locator(".overview-orbit strong").textContent(),"92/100");
  await page.screenshot({path:"lw2-desktop-qa.png",fullPage:true});
  await page.locator('[data-lw2-go="ships"]').first().click();
  assert.equal(new URL(page.url()).hash,"#approved-shipments");
  await page.goto(host+"/fixture#transport-applications",{waitUntil:"networkidle"});
  assert.equal(new URL(page.url()).hash,"#approved-shipments");
  await page.setViewportSize({width:390,height:844});
  await page.goto(host+"/fixture",{waitUntil:"networkidle"});
  await page.locator("#lw2-dashboard .lw2-type").first().waitFor({timeout:10000});
  const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
  assert.ok(layout.scroll<=layout.view+2,JSON.stringify(layout));
  await page.screenshot({path:"lw2-mobile-qa.png",fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
