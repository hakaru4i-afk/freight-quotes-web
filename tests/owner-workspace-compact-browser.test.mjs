import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
const url="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const roles=["overview","create-request","request-registry","offers","answers","tender-hub","approved-shipments","winner-chats","transport-claims","incident-journal","supplier-orders","content-tasks","management-reports","carrier-service","sla","site-monitor","team","access-levels","portal-feedback","help","transport-applications"];
async function checkViewport(browser,width,height){
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 try{
  await page.goto(url+"?page=login",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>!!document.querySelector('script[src*="owner-workspace-compact-20261108.js"]'),{timeout:25000});
  await page.evaluate((ids)=>{
   const preview=document.createElement("aside");
   preview.className="test-cabinets";
   preview.innerHTML='<div class="cabinet-preview-info"><b>Просмотр кабинетов · тестовая среда</b><p>Сейчас: ваш кабинет владельца</p><small>Действия сохраняются в тестовой среде</small></div><div class="test-cabinet-actions"><div class="cabinet-role-grid">'+["Мой кабинет","Перевозчик","ВЭД","Поставщик","Контент-менеджер","Дизайнер","Менеджер по закупкам","Специалист по сертификации"].map(s=>'<button class="btn">'+s+'</button>').join("")+'</div><label class="field">Пользователь для просмотра<select><option>Владелец — мой кабинет</option></select></label></div><nav class="issue47-owner-registers"><a href="#one">Журнал замечаний</a><a href="#two">Реестр разработок</a><a href="#three">Реестр обновлений</a></nav>';
   const fixture=document.createElement("div");
   fixture.className="cabinet-app staff-portal";
   fixture.setAttribute("data-cabinet-role","owner");
   fixture.innerHTML='<div class="cabinet-layout"><aside class="cabinet-sidebar"><a class="cabinet-brand" href="#overview"><span>↗</span><div>Маршрут<span>ЛОГИСТИЧЕСКИЙ ПОРТАЛ</span></div></a><div class="cabinet-role">Кабинет владельца</div><nav>'+ids.map(id=>'<a href="#'+id+'"><span>◇</span>'+id+'</a>').join("")+'</nav></aside><div class="cabinet-body"><header class="cabinet-topbar"><h1>Моя нагрузка</h1></header><main class="cabinet-content"><section class="cabinet-panel" data-section="overview"><div class="overview-welcome"><div><span class="eyebrow">ВАШ ЦЕНТР УПРАВЛЕНИЯ</span><h2>Все решения.<br>В одном месте.</h2><p>Текущая нагрузка и то, что требует вашего участия.</p><button class="btn">+ Новая заявка</button></div><div class="overview-orbit"><small>Ожидают вас</small><strong>0</strong></div></div></section></main></div></div>';
   const root=document.getElementById("root")||document.body;
   root.append(preview,fixture);
  },roles);
  await page.waitForFunction(()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]')?.dataset.lwOwnerHierarchy==="20261108",{timeout:12000});
  const metrics=await page.evaluate(()=>{
    const root=document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
    const nav=root.querySelector('.cabinet-sidebar nav');
    const links=[...nav.querySelectorAll("a[href]")];
    const deferred=links.find(a=>a.getAttribute("href")==="#transport-applications");
    const preview=document.querySelector(".test-cabinets.lw-preview-compact");
    return {
      preview:preview?.getBoundingClientRect().height,
      roleTrigger:!!root.querySelector('.lw-cc-role-trigger'),
      hero:root.querySelector(".overview-welcome")?.getBoundingClientRect().height,
      groups:links.filter(a=>a.dataset.lwOwnerGroupStart).map(a=>a.dataset.lwOwnerGroupStart),
      deferredHidden:deferred?getComputedStyle(deferred).display==="none":false,
      requestsOrder:getComputedStyle(links.find(a=>a.getAttribute("href")==="#create-request")).order,
      executionOrder:getComputedStyle(links.find(a=>a.getAttribute("href")==="#approved-shipments")).order,
      width:document.documentElement.scrollWidth
    };
  });
  assert.ok(metrics.preview===0||(metrics.preview>0&&metrics.preview<300),"Role preview takes excessive space: "+JSON.stringify(metrics));
  if(metrics.preview===0)assert.equal(metrics.roleTrigger,true,"Collapsed role switcher missing header trigger");
  assert.ok(metrics.hero===0||(metrics.hero>0&&metrics.hero<205),"Old welcome hero is oversized: "+JSON.stringify(metrics));
  assert.ok(metrics.groups.some(x=>x.includes("Заявки и ставки")),"Owner hierarchy title missing");
  assert.ok(metrics.deferredHidden,"Deferred transport application remains in active Owner menu");
  assert.ok(Number(metrics.requestsOrder)<Number(metrics.executionOrder),"Request/Execution hierarchy incorrect");
  assert.ok(metrics.width<=width+6,"Horizontal viewport overflow: "+JSON.stringify(metrics));
  assert.deepEqual(errors,[],"Browser JS errors");
  await page.screenshot({path:"owner-compact-"+width+".png",fullPage:true});
 }finally{await page.close()}
}
test("staging Owner compact and grouped layout at desktop and mobile",{timeout:180000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{await checkViewport(browser,1366,768);await checkViewport(browser,390,844)}
 finally{await browser.close()}
});
