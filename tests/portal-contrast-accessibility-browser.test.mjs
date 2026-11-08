import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";

// Match the real cascade, including late role/component styles.
const entry=readFileSync("test/index.html","utf8");
const files=[...entry.matchAll(/<link\s+rel="stylesheet"\s+href="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(match=>match[1]);
const css=files.map(file=>readFileSync("test/"+file,"utf8"));
const roles=["owner","carrier","logistic","ved","supplier","designer","content","purchasing","certification"];
const html=(role)=>`<!doctype html><html lang="ru"><meta charset="utf-8"><body>
<div class="cabinet-app ${role==="owner"?"staff-portal lw-cc-active":role==="carrier"?"carrier-portal":"staff-portal"}" data-cabinet-role="${role}">
<div class="cabinet-layout">
  <aside class="cabinet-sidebar mobile-open"><nav class="${role==="owner"?"lw-owner-nav":""}"><a id="nav-item" href="#answers">Контроль ответов</a><a id="nav-current" href="#offers" aria-current="page">Рассмотрение ставок</a></nav></aside>
  <main class="cabinet-content">
    <div class="cabinet-panel" data-section="answers">
      <section class="card">
        <h2>Контроль ответов по заявкам</h2>
        <p class="notice" id="light-notice"><span id="light-notice-copy">Здесь согласуется перевозчик.</span></p>
        <p class="error"><span id="error-copy">Проверьте номер заявки.</span></p>
        <p class="warning"><span id="warning-copy">Проверьте срок.</span></p>
        <label class="field">Название<input id="field" placeholder="Введите название"></label>
        <button class="btn" id="disabled-button" disabled>Публикация недоступна</button>
        <div class="tablewrap"><table><thead><tr><th>ПЕРЕВОЗЧИК</th><th>СТАТУС</th></tr></thead>
          <tbody><tr id="answer-row"><td><span id="answer-cell-text">test.carrier.alpha</span></td>
            <td><span class="badge" id="answer-badge">Допущен к рассмотрению</span></td></tr></tbody>
        </table></div>
      </section>
    </div>
    <div class="cabinet-panel" data-section="offers">
      <section class="card">
       <h2>Рассмотрение ставок</h2>
       <div class="tablewrap"><table><thead><tr><th>ЗАКАЗ / ПОЛУЧЕНО</th><th>ТРАНСПОРТ</th><th>СТАВКА</th></tr></thead>
        <tbody>
         <tr class="offer-row-unavailable"><td><div class="small" id="red-small">Битрикс: 7654</div></td>
          <td><div class="offer-insight"><p id="red-copy">Ставка не допущена или перевозчик заблокирован</p><b class="offer-label offer-label-unavailable" id="red-label">Вне сопоставления</b></div></td>
          <td><button type="button" class="btn secondary" id="red-button">Изменить ставку</button></td></tr>
         <tr class="offer-row-good"><td><div class="small" id="green-small">08.11.2026</div></td>
          <td><div class="offer-insight"><p id="green-copy">Станция отправления: Нинбо</p><b class="offer-label offer-label-good" id="green-label">Выгодно по цене и сроку</b></div></td>
          <td><button type="button" class="btn" id="green-button">Выбрать этот вариант</button></td></tr>
         <tr class="offer-row-review"><td id="amber-cell">Проверить маршрут</td><td colspan="2">Условия доставки</td></tr>
         <tr class="offer-row-alternative"><td id="neutral-cell">Есть выгоднее</td><td colspan="2">Срок</td></tr>
        </tbody>
       </table></div>
      </section>
    </div>
  </main>
</div>
</div></body></html>`;

// The hidden-text raster supplies the actual composited background, including
// role gradients and translucent ancestors. Browser CSS supplies text fill,
// size, weight and effective opacity; foreground is blended over the raster.
async function readSamples(page, selectors) {
  const samples=await page.evaluate(selectors=>selectors.map(selector=>{
    const el=document.querySelector(selector.replace(/::placeholder$/, ""));
    if(!el)throw Error("Missing sample "+selector);
    const placeholder=selector.endsWith("::placeholder");
    const style=getComputedStyle(el,placeholder?"::placeholder":null);
    const canvas=document.createElement("canvas");
    const context=canvas.getContext("2d",{willReadFrequently:true});
    context.fillStyle=style.getPropertyValue("-webkit-text-fill-color")||style.color;
    context.fillRect(0,0,1,1);
    const rgba=[...context.getImageData(0,0,1,1).data];
    let opacity=placeholder?Number(style.opacity):1;
    for(let node=el;node;node=node.parentElement) opacity*=Number(getComputedStyle(node).opacity);
    const range=document.createRange();
    range.selectNodeContents(el);
    const rect=placeholder?el.getBoundingClientRect():range.getBoundingClientRect();
    const clip=el.getBoundingClientRect();
    const left=Math.max(0,rect.left,clip.left);
    const right=Math.min(document.documentElement.scrollWidth,rect.right,clip.right);
    const y=scrollY+Math.max(0,(Math.max(rect.top,clip.top)+Math.min(rect.bottom,clip.bottom))/2);
    if(right<=left||!clip.height)throw Error("Invisible sample "+selector);
    return {selector,rgba,opacity,y,x:[.15,.5,.85].map(t=>left+(right-left)*t+scrollX),
      threshold:parseFloat(style.fontSize)>=(Number(style.fontWeight)>=700?18.667:24)?3:4.5};
  }),selectors);
  const hide=await page.addStyleTag({content:"@layer lw-audit { *,*::placeholder{-webkit-text-fill-color:transparent!important;text-shadow:none!important} }"});
  let png;
  try { png=await page.screenshot({fullPage:true,scale:"css"}); }
  finally { await hide.evaluate(node=>node.remove()); }
  return page.evaluate(async({samples,png})=>{
    const image=await createImageBitmap(new Blob([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],{type:"image/png"}));
    const canvas=document.createElement("canvas");
    canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const luminance=rgb=>rgb.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4})
      .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    return samples.map(sample=>{
      const alpha=sample.opacity*sample.rgba[3]/255;
      const backgrounds=sample.x.map(x=>[...ctx.getImageData(Math.floor(x),Math.floor(sample.y),1,1).data].slice(0,3));
      const ratio=Math.min(...backgrounds.map(bg=>{
        const a=luminance(bg),b=luminance(bg.map((v,i)=>v*(1-alpha)+sample.rgba[i]*alpha));
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      }));
      return {...sample,backgrounds,ratio};
    });
  },{samples,png:png.toString("base64")});
}
async function readable(page,selectors) {
 const samples=await readSamples(page,selectors);
 return samples.map(({selector,ratio,threshold,rgba,backgrounds,opacity})=>({selector,ratio,threshold,rgba,backgrounds,opacity}));
}

test("shared component palettes / text and background at desktop and mobile",{timeout:180000},async()=>{
 const browser=await chromium.launch({headless:true});
 const protocol=[];
 const layoutFailures=[];
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   try{
    for(const role of roles){
     await page.goto("about:blank");
     await page.setContent(html(role));
     for(const styles of css)await page.addStyleTag({content:styles});
     // Fixture injects CSS after DOM; real Pages parses linked styles before the DOM.
     // Wait for the legacy nav color transition so sampling checks final contrast.
     await page.waitForTimeout(280);
     const record=async(state,selectors)=>protocol.push({role,viewport,state,samples:await readable(page,selectors)});
     await record("default-selected-disabled",["#light-notice-copy","#nav-item","#nav-current","#error-copy","#warning-copy",
       "#field::placeholder","#disabled-button","#red-small","#red-copy","#red-label","#green-small","#green-copy",
       "#green-label","#amber-cell","#neutral-cell"]);
     for(const selector of ["#red-button","#green-button"]){
      await page.locator(selector).scrollIntoViewIfNeeded();
      await record("button-default",[selector]);
     }
     await page.locator("#nav-item").hover();
     await record("menu-hover",["#nav-item"]);
     await page.locator("#answer-row").hover();
     await record("row-hover",["#answer-cell-text","#answer-badge"]);
     await page.locator("#green-button").hover();
     await record("button-hover",["#green-button"]);
     await page.mouse.down();
     try { await record("button-active",["#green-button"]); } finally { await page.mouse.up(); }
     await page.keyboard.press("Tab");
     await page.locator("#field").focus();
     assert.notEqual(await page.locator("#field").evaluate(el=>getComputedStyle(el).outlineStyle),"none");
     await record("field-focus",["#field::placeholder"]);
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     if(overflow>4) layoutFailures.push({role,viewport,overflow});
     if(role==="owner")await page.screenshot({path:"portal-contrast-"+viewport.width+"-owner.png",fullPage:true});
     if(role==="carrier")await page.screenshot({path:"portal-contrast-"+viewport.width+"-carrier.png",fullPage:true});
    }
   }finally{await page.close();}
  }
  const failures=protocol.flatMap(({role,viewport,state,samples})=>samples.filter(s=>s.ratio<s.threshold).map(s=>({role,width:viewport.width,state,...s})));
  console.log(JSON.stringify({samples:protocol.reduce((n,row)=>n+row.samples.length,0),violations:failures.length,layoutFailures:layoutFailures.length}));
  assert.deepEqual({violations:failures.slice(0,15),layoutFailures},{violations:[],layoutFailures:[]});
 }finally{writeFileSync("portal-contrast-protocol.json",JSON.stringify(protocol,null,2));await browser.close();}
});

// Run the actual staging bundle in an isolated browser session. All network
// calls are fulfilled locally, including auth, so no staging data is read or changed.
test("staging app role shells with synthetic sessions at both viewports",{timeout:240000},async()=>{
 const browser=await chromium.launch({headless:true});
 const protocol=[];
 const errors=[];
 const roles=["owner","carrier","logistic","supplier","designer","content","purchasing","certification"];
 const origin="https://contrast-qa.invalid";
 const types={html:"text/html",js:"text/javascript",mjs:"text/javascript",css:"text/css",json:"application/json",svg:"image/svg+xml"};
 try {
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   for(const role of roles){
    const page=await browser.newPage({viewport,reducedMotion:"reduce"});
    try {
     await page.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin&&url.pathname.startsWith("/test/")){
       const file=url.pathname==="/test/"?"index.html":url.pathname.slice(6);
       try {
        return await route.fulfill({body:readFileSync("test/"+file),contentType:types[file.split(".").at(-1)]||"application/octet-stream"});
       } catch { return route.fulfill({status:404,body:"Fixture asset unavailable"}); }
      }
      if(!url.pathname.includes("/freight-api/api/"))return route.abort();
      const headers={"access-control-allow-origin":origin,"access-control-allow-credentials":"true","access-control-allow-headers":route.request().headers()["access-control-request-headers"]||"content-type"};
      if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers});
      const body={role,user:{role},access:{owner:role==="owner",permissions:["workspace.read","requests.read","documents.read"]},
       carrierPolicy:{blocked:false,level:90},presets:[],users:[],profiles:[],roleProfiles:[],requests:[],bids:[],answers:[],
       selections:[],reports:[],approvals:[],notifications:[],items:[],tasks:[],orders:[],rows:[],categories:[],messages:[],
       chats:[],awards:[],roles:[],counts:{deliveries:0,incidents:0},total:0};
      return route.fulfill({status:200,headers,json:body});
     });
     await page.goto(origin+"/test/");
     const shell=page.locator("[data-cabinet-role]");
     await shell.first().waitFor({state:"visible",timeout:8000});
     const toggle=page.locator(".cabinet-menu-toggle").first();
     if(await toggle.isVisible())await toggle.click();
     const menu=".cabinet-sidebar nav a,.sw-sidebar nav button";
     await page.locator(menu).first().waitFor({state:"visible",timeout:8000});
     const selectors=await page.evaluate(menu=>{
      const nodes=[...document.querySelectorAll(menu)]
       .filter(el=>el.checkVisibility({visibilityProperty:true})&&el.innerText.trim());
      for(const [index,el] of nodes.entries())el.setAttribute("data-contrast-qa",String(index));
      return nodes.map((_,i)=>'[data-contrast-qa="'+i+'"]');
     },menu);
     assert.ok(selectors.length,"role navigation has no visible text");
     const visible=await page.evaluate(selectors=>selectors.filter(selector=>{
      const r=document.querySelector(selector).getBoundingClientRect();
      return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;
     }),selectors);
     const deferred=selectors.filter(selector=>!visible.includes(selector));
     const samples=await readable(page,visible);
     for(const selector of deferred){
      await page.locator(selector).scrollIntoViewIfNeeded();
      samples.push(...await readable(page,[selector]));
     }
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     protocol.push({role,viewport,actualRole:await shell.first().getAttribute("data-cabinet-role"),samples,overflow});
     if(["owner","carrier","logistic","supplier","content"].includes(role))
      await page.screenshot({path:"portal-contrast-"+viewport.width+"-app-"+role+".png",fullPage:true});
    } catch(error){
     errors.push({role,viewport,error:String(error.message).split("\n")[0]});
    } finally { await page.close(); }
   }
  }
 } finally {
  await browser.close();
  writeFileSync("portal-contrast-app-protocol.json",JSON.stringify({scope:"isolated app navigation",protocol,errors},null,2));
 }
 const violations=protocol.flatMap(({role,viewport,samples})=>samples.filter(s=>s.ratio<s.threshold).map(s=>({role,viewport,...s})));
 console.log(JSON.stringify({appRoleViewports:protocol.length,errors:errors.length,violations:violations.length}));
 const overflow=protocol.filter(row=>row.overflow>4).map(({role,viewport,overflow})=>({role,viewport,overflow}));
 assert.deepEqual({violations:violations.slice(0,12),errors,overflow},{violations:[],errors:[],overflow:[]});
});
