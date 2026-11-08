import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {readFileSync} from "node:fs";
const URL="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const roles=["owner","carrier","logistic","supplier","designer","content_manager","purchasing_manager","certification"];
async function hoverState(page,id){
 const locator=page.locator("#hover-qa-"+id);
 await locator.hover();
 return locator.evaluate(el=>{
  const st=getComputedStyle(el),after=getComputedStyle(el,"::after");
  return {filter:st.filter,bg:st.backgroundColor,image:st.backgroundImage,color:st.color,
    transform:st.transform,pseudo:after.display,content:after.content,hover:el.matches(":hover"),
    roleClass:el.closest("[data-cabinet-role]")?.className,forcedColors:matchMedia("(forced-colors: active)").matches,forcedColorAdjust:st.forcedColorAdjust,
    darkSelector:el.matches(':is(.carrier-portal,.staff-portal[data-cabinet-role="owner"]) :is(.cabinet-panel,.cabinet-content) button:not(.btn):not(.t2-btn):hover:not(:disabled):not([aria-disabled="true"])'),
    cssDebug:(()=>{const sheet=[...document.styleSheets].at(-1);let rs;try{rs=[...sheet.cssRules]}catch(e){return String(e)}return {inline:true,number:rs.length,matches:rs.filter(x=>x.selectorText?.includes('button:not(.btn):not(.t2-btn)')).map(x=>x.cssText.slice(0,320))}})(),
    matchingStyles:(()=>{const a=[];for(const sheet of document.styleSheets){let rules;try{rules=[...sheet.cssRules]}catch(e){continue}
      for(const rule of rules){try{if(rule.selectorText&&el.matches(rule.selectorText)&&(rule.style?.getPropertyValue('background')||rule.style?.getPropertyValue('background-color')||rule.style?.getPropertyValue('color'))){a.push({selector:rule.selectorText.slice(0,150),background:rule.style.background,backgroundColor:rule.style.backgroundColor,color:rule.style.color,priority:rule.style.getPropertyPriority('background'),source:sheet.href?.split('/').at(-1)})}}catch(e){}}
    }return a.slice(-20)})()};
 });
}
test("glare-free hover across eight roles, forms, tabs and login at desktop and mobile",{timeout:240000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   try{
    // Isolated DOM: the portal's own MutationObservers otherwise delete synthetic
    // feedback panels. The served step separately verifies the exact CSS on Pages.
    await page.goto("about:blank");
    await page.addStyleTag({content:readFileSync("test/style.css","utf8")});
    await page.addStyleTag({content:readFileSync("test/lw-hover-safe-20261108.css","utf8")});
    await page.evaluate(roles=>{
      const root=document.getElementById("root");if(root)root.style.display="none";
      const box=document.createElement("div");box.id="hover-qa-fixture";
      box.style.cssText="padding:16px;background:#071527;display:grid;gap:8px;max-width:100vw";
      for(const role of roles){
       const parent=document.createElement("div");
       parent.className="cabinet-app "+(role==="owner"?"staff-portal lw-cc-active":role==="carrier"?"carrier-portal":"staff-portal");
       parent.dataset.cabinetRole=role;parent.style.cssText="min-height:0;padding:7px";
       parent.innerHTML='<div class="cabinet-body"><header class="cabinet-topbar"><button class="btn secondary" id="hover-qa-'+role+'-header">Профиль</button></header><main class="cabinet-content"><section class="cabinet-panel"><button class="btn" id="hover-qa-'+role+'-primary">Создать заявку</button><button class="btn secondary" id="hover-qa-'+role+'-secondary">Отказаться</button><button id="hover-qa-'+role+'-plain">Подтвердить</button><button class="btn" disabled id="hover-qa-'+role+'-disabled">Недоступно</button></section></main></div>';
       if(role==="owner" || role==="carrier"){
         const light=document.createElement("div");
         light.className="compact-transport-document";
         light.innerHTML='<button id="hover-qa-'+role+'-lightdoc">Подписать документ</button>';
         parent.querySelector(".cabinet-panel").append(light);
       }
       box.append(parent);
      }
      const carrier=box.querySelector('[data-cabinet-role="carrier"] .cabinet-panel');
      const task=document.createElement("div");task.id="task2-root";
      task.innerHTML='<section class="t2-stage"><button class="t2-btn ghost" id="hover-qa-task2-ghost">Загрузить документы</button><button id="hover-qa-task2-light">Просмотр</button></section><div class="t2-tabs"><button id="hover-qa-task2-tab">Заявки</button></div>';
      carrier.append(task);
      const feedback=document.createElement("section");feedback.id="portal-feedback-root";
      feedback.innerHTML='<button id="hover-qa-feedback">Отправить предложение</button>';
      carrier.append(feedback);
      const auth=document.createElement("section");auth.className="cycle-landing";
      auth.innerHTML='<div class="cycle-login"><div class="auth-card"><form><button class="btn" id="hover-qa-login">Войти</button></form></div></div><div class="cycle-role-tabs"><button id="hover-qa-role-tab">Роль</button></div>';
      box.append(auth);document.body.appendChild(box);
    },roles);
    for(const role of roles){
      for(const type of ["primary","secondary","header","plain"]){
        const state=await hoverState(page,role+"-"+type);
        assert.equal(state.filter,"none",JSON.stringify({role,type,state}));
        assert.equal(state.transform,"none",JSON.stringify({role,type,state}));
        assert.notEqual(state.color,"rgba(0, 0, 0, 0)",JSON.stringify({role,type,state}));
        if(type!=="plain")assert.equal(state.pseudo,"none",JSON.stringify({role,type,state}));
        if(["owner","carrier"].includes(role)&&type==="plain"){
          assert.equal(state.bg,"rgb(27, 64, 92)",JSON.stringify({role,type,state}));
          assert.equal(state.color,"rgb(240, 248, 255)",JSON.stringify({role,type,state}));
        }
      }
      if(role==="owner" || role==="carrier"){
        const state=await hoverState(page,role+"-lightdoc");
        assert.equal(state.bg,"rgb(230, 240, 236)",JSON.stringify({role,state}));
        assert.equal(state.color,"rgb(23, 75, 58)",JSON.stringify({role,state}));
      }
      const opacity=await page.locator("#hover-qa-"+role+"-disabled").evaluate(el=>getComputedStyle(el).opacity);
      assert.ok(Number(opacity)<=0.6,"disabled button unchanged: "+role);
    }
    for(const id of ["task2-ghost","task2-light","task2-tab","login","role-tab"]){
      const state=await hoverState(page,id);
      assert.equal(state.filter,"none",JSON.stringify({id,state}));
      assert.equal(state.transform,"none",JSON.stringify({id,state}));
      if(id==="task2-light"){
        assert.equal(state.bg,"rgb(230, 240, 236)",JSON.stringify({id,state}));
        assert.equal(state.color,"rgb(23, 75, 58)",JSON.stringify({id,state}));
      }
    }
    await page.screenshot({path:"lw-hover-safe-"+viewport.width+".png",fullPage:true});
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
// This check uses the real published staging login DOM, not a synthetic cabinet.
// Authorized checks across real role cabinets remain a separate E2E requirement.
test("actual served staging login hover has no white glare on desktop and mobile",{timeout:130000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   const errors=[]; page.on("pageerror",e=>errors.push(e.message));
   try{
    const response=await page.goto(URL+"?page=login",{waitUntil:"domcontentloaded",timeout:40000});
    assert.equal(response?.status(),200,"Published staging page is inaccessible");
    const button=page.locator(".cycle-landing .cycle-login .auth-card form>.btn").first();
    await button.waitFor({state:"visible",timeout:30000});
    await button.hover();
    const actual=await button.evaluate(el=>{
      const st=getComputedStyle(el);
      return {hover:el.matches(":hover"),filter:st.filter,shadow:st.textShadow,background:st.backgroundImage,color:st.color,
        shield:[...document.styleSheets].some(s=>s.href?.includes("lw-hover-safe-20261108.css?v=lw-hover-03")),
        bodyOverflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.equal(actual.hover,true,JSON.stringify(actual));
    assert.equal(actual.shield,true,"Actual published CSS cache version not installed");
    assert.equal(actual.filter,"none",JSON.stringify(actual));
    assert.equal(actual.shadow,"none",JSON.stringify(actual));
    assert.match(actual.background,/linear-gradient/,"Login hover must retain subdued gold gradient");
    assert.equal(actual.color,"rgb(32, 23, 12)",JSON.stringify(actual));
    assert.ok(actual.bodyOverflow<=4,"Mobile layout overflow: "+JSON.stringify(actual));
    assert.deepEqual(errors,[],"Actual staging login JavaScript errors");
    await page.screenshot({path:"lw-hover-safe-served-login-"+viewport.width+".png",fullPage:true});
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
