import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const files=[
 "style.css",
 "task2.css",
 "task2-contrast-hotfix.css",
 "owner-workspace-compact-20261108.css",
 "owner-command-center-20261108.css",
 "lw-hover-safe-20261108.css",
 "portal-contrast-accessibility-20261108.css"
];
const css=files.map(file=>readFileSync("test/"+file,"utf8"));
const roles=["owner","carrier","logistic","supplier","designer","content_manager","purchasing_manager","certification"];
const html=(role)=>`<!doctype html><html lang="ru"><meta charset="utf-8"><body>
<div class="cabinet-app ${role==="owner"?"staff-portal lw-cc-active":role==="carrier"?"carrier-portal":"staff-portal"}" data-cabinet-role="${role}">
<div class="cabinet-layout">
  <aside class="cabinet-sidebar"><nav><a id="nav-item" href="#answers">Контроль ответов</a></nav></aside>
  <main class="cabinet-content">
    <div class="cabinet-panel" data-section="answers">
      <section class="card">
        <h2>Контроль ответов по заявкам</h2>
        <p class="notice" id="light-notice"><span id="light-notice-copy">Здесь согласуется перевозчик.</span></p>
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

const swatches=async(page,selector)=>{
 const locator=page.locator(selector);
 return locator.evaluate(el=>{
   let node=el,bg="rgba(0, 0, 0, 0)",fg=getComputedStyle(el).color;
   while(node){
    const c=getComputedStyle(node).backgroundColor;
    if(c!=="rgba(0, 0, 0, 0)"&&c!=="transparent"){bg=c;break;}
    node=node.parentElement;
   }
   return {fg,bg,text:el.textContent.trim().slice(0,60)};
 });
};
function rgb(s){const m=s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)throw Error("Unresolved rgb: "+s);return m.slice(1,4).map(Number);}
function luminance(s){return rgb(s).map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);}
function contrast(fg,bg){const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
async function readable(page,selector,threshold=4.5){
 const s=await swatches(page,selector),ratio=contrast(s.fg,s.bg);
 assert.ok(ratio>=threshold,JSON.stringify({selector,...s,ratio,threshold}));
}

test("semantic text contrast in eight role cabinets / light alerts and dark tables / desktop + mobile",{timeout:180000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   try{
    for(const role of roles){
     await page.goto("about:blank");
     await page.setContent(html(role));
     for(const styles of css)await page.addStyleTag({content:styles});
     await readable(page,"#light-notice-copy");
     await readable(page,"#nav-item");
     await page.locator("#answer-row").hover();
     await readable(page,"#answer-cell-text");
     await readable(page,"#answer-badge");
     for(const selector of ["#red-small","#red-copy","#red-label","#green-small","#green-copy","#green-label","#amber-cell","#neutral-cell"]){
      await readable(page,selector);
     }
     await readable(page,"#red-button");
     await readable(page,"#green-button");
     await page.locator("#green-button").hover();
     await readable(page,"#green-button");
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     assert.ok(overflow<=4,"Horizontal overflow: "+role+" / "+viewport.width+": "+overflow);
     if(role==="owner")await page.screenshot({path:"portal-contrast-"+viewport.width+"-owner.png",fullPage:true});
     if(role==="carrier")await page.screenshot({path:"portal-contrast-"+viewport.width+"-carrier.png",fullPage:true});
    }
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});
