import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";

const url="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const api="https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/partner-inquiries";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitUntilDeployed(page){
 for(let n=0;n<30;n++){
  await page.goto(url+"?page=login",{waitUntil:"domcontentloaded",timeout:35000});
  try {
   await page.locator("#lw-contact-form").waitFor({timeout:3000});
   return;
  } catch {}
  await delay(2500);
 }
 throw Error("Staging Pages did not serve cooperation form");
}
test("staging public form, no language circle, role help and inline field description",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
   const page=await browser.newPage({viewport});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await waitUntilDeployed(page);
   const result=await page.evaluate(()=>{
    const form=document.querySelector("#lw-contact-form");
    const ghost=document.querySelector(".language-control > span[aria-hidden='true']");
    const isHidden=e=>!e||getComputedStyle(e).display==="none";
    return {
     form:!!form,
     circleHidden:isHidden(ghost),
     submitText:form?.querySelector('button[type="submit"]')?.textContent,
     navHref:document.querySelector("[data-lw-cooperation]")?.getAttribute("href"),
     width:document.documentElement.scrollWidth,
     validEmpty:form?.checkValidity(),
     fields:["partnerKind","company","contactName","contactDetails","message","consent"].every(name=>!!form?.querySelector("[name='"+name+"']")),
     guideLoaded:!!document.querySelector('script[src*="current-workspace-help-20261108.js"]')
    };
   });
   assert.equal(result.form,true);
   assert.equal(result.circleHidden,true,"Extra language circle still visible");
   assert.equal(result.navHref,"#lw-partners");
   assert.equal(result.validEmpty,false,"Form must validate required fields");
   assert.equal(result.fields,true,"Contact fields missing");
   assert.equal(result.guideLoaded,true,"Current role-help script not deployed");
   assert.ok(result.width<=viewport.width+4,"Horizontal scrolling");
   await page.evaluate(()=>{
    const fixture=document.createElement("section");
    fixture.className="cabinet-app";fixture.setAttribute("data-cabinet-role","owner");
    fixture.innerHTML='<section class="cabinet-panel" data-section="help"><h1>Помощь / FAQ</h1></section><form><label>Номер заказа<input name="orderCode"></label><label>Ставка<input name="amount"></label></form>';
    document.querySelector("#root")?.appendChild(fixture);
   });
   await page.locator("#lw-current-help").waitFor({timeout:10000});
   await page.locator(".lw-field-help").first().waitFor({timeout:10000});
   let faq=await page.locator("#lw-current-help").innerText();
   assert.match(faq,/Bitrix|Битрикс|Владелец|Owner/);
   assert.match(faq,/транспортная заявка|transport application/i,"Deferred feature should be explained, not offered");
   const helpers=await page.locator(".cabinet-app .lw-field-help").count();
   assert.ok(helpers>=2,"Visible explanations under fields missing");
   const firstHelp=await page.locator(".cabinet-app .lw-field-help").first().innerText();
   assert.ok(firstHelp.length>15,"Field explanation empty");
   assert.deepEqual(errors,[],"Browser JavaScript errors");
   await page.close();
  }
 } finally {await browser.close()}
});
test("public endpoint rejects unauthenticated reading and malformed submission",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext();
  const read=await ctx.request.get(api,{timeout:30000});
  assert.ok([401,403].includes(read.status()),"Public access to Owner inbox: "+read.status());
  const invalid=await ctx.request.post(api,{headers:{"Content-Type":"application/json","Origin":"https://hakaru4i-afk.github.io"},data:{"partnerKind":"supplier"},timeout:30000});
  assert.equal(invalid.status(),400,"Backend did not reject incomplete partnership form");
  await ctx.close();
 }finally{await browser.close()}
});
test("one real QA cooperation submission reaches server",{skip:process.env.LW_SUBMIT_QA!=="1"},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await waitUntilDeployed(page);
  await page.locator("#lw-contact-form [name=partnerKind]").selectOption("supplier");
  await page.locator("#lw-contact-form [name=company]").fill("QA_ONLY_LW_20261108");
  await page.locator("#lw-contact-form [name=contactName]").fill("Automated QA");
  await page.locator("#lw-contact-form [name=contactDetails]").fill("qa-internal@example.invalid");
  await page.locator("#lw-contact-form [name=message]").fill("QA-only test request; will be purged from staging.");
  await page.locator("#lw-contact-form [name=consent]").check();
  const resPromise=page.waitForResponse(r=>r.url().includes("/api/partner-inquiries")&&r.request().method()==="POST",{timeout:30000});
  await page.locator("#lw-contact-form button[type=submit]").click();
  const resp=await resPromise;
  assert.equal(resp.status(),201,"Public inquiry API refused valid form");
  const body=await resp.json();
  assert.equal(body.ok,true);
  assert.match(body.reference,/^[0-9a-f]{8}$/);
  await page.locator(".lw-contact-result.lw-ok").waitFor({timeout:10000});
 }finally{await browser.close()}
});

test("public FAQ route DOM inspection",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await page.goto(url+"?page=help",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForTimeout(1400);
  const info=await page.evaluate(()=>({
    title:document.title,
    url:location.href,
    h:[...document.querySelectorAll("h1,h2,h3")].map(n=>({tag:n.tagName,txt:n.textContent.trim().slice(0,90),cls:n.className})).slice(0,20),
    children:[...document.querySelectorAll("#root>*,main,section")].map(n=>({tag:n.tagName,cls:n.className,id:n.id})).slice(0,25),
    text:document.body.textContent.slice(0,600)
  }));
  console.log("LW_PUBLIC_HELP_DOM="+JSON.stringify(info));
  assert.ok(info.text.length>15);
 } finally {await browser.close();}
});
