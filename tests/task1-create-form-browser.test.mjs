import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {join,resolve,extname} from "node:path";
import {chromium} from "playwright";

const root=resolve("test");
const mime={".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
function server(){
 return createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,"http://127.0.0.1");
   let p=url.pathname==="/test/"?"/test/index.html":url.pathname;
   if(!p.startsWith("/test/")){res.writeHead(404);res.end();return}
   const file=resolve("."+p);
   if(!file.startsWith(root+"/")){res.writeHead(403);res.end();return}
   const buffer=await readFile(file);
   res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
   res.end(buffer);
  }catch{res.writeHead(404);res.end()}
 });
}
async function fixture(t){
 const srv=server();await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true});
 t.after(async()=>{await browser.close();await new Promise(ok=>srv.close(ok))});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const posted=[],errors=[],failedRequests=[];
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text().slice(0,300))});
 page.on("requestfailed",r=>failedRequests.push(r.url()+": "+r.failure()?.errorText));
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",d=>d.accept());
 await page.route("https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/**",async(route)=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.split("/freight-api")[1]||"";
  const respond=(status,payload)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(payload),headers:{"Access-Control-Allow-Origin":"*"}});
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
  if(path==="/api/test-cabinets")return respond(200,{environment:"staging",presets:[],users:[]});
  if(path==="/api/session")return respond(200,{role:"owner"});
  if(path==="/api/access")return respond(200,{access:{owner:true,permissions:["workspace.read","requests.manage","documents.read"]},users:[],roles:[],profiles:[],roleProfiles:[]});
  if(path==="/api/data")return respond(200,{role:"owner",bids:[],answers:[],selections:[],reports:[],approvals:[],notifications:[],requests:[]});
  if(path==="/api/documents"&&req.method()==="GET")return respond(200,{files:[],access:"QA-ISOLATED-ONLY"});
  if(path==="/api/workload")return respond(200,{total:0,requests:0,shipments:0,categories:[],counts:{deliveries:0,incidents:0},items:[]});
  if(path.startsWith("/api/requests")&&req.method()==="GET")return respond(404,{error:"QA: no existing request"});
  if(path==="/api/requests"&&req.method()==="POST"){
   const body=req.postDataJSON();posted.push(body);
   if(!body.order||!body.deadline)return respond(400,{error:"QA: missing order/deadline"});
   return respond(200,{ok:true,round:"qa-round-1",recipients:3});
  }
  return respond(200,{ok:true,role:"owner",items:[],tasks:[],users:[],rows:[],rounds:[],responses:[],events:[]});
 });
 await page.goto("http://127.0.0.1:"+srv.address().port+"/test/#create-request",{waitUntil:"domcontentloaded",timeout:30000});
 const order=page.locator('input[aria-label="Номер заказа *"]').first();
 try{await order.waitFor({state:"attached",timeout:9000})}catch(e){
   await page.screenshot({path:"reports/t1-01-page-diagnostic.png",fullPage:true}).catch(()=>{});
   const snapshot=(await page.locator("body").innerText().catch(()=>"(no body)")).slice(0,1500);
   throw Error("Owner form absent. URL="+page.url()+" BODY="+snapshot+" JSERRORS="+JSON.stringify(errors.slice(0,5))+" REQFAIL="+JSON.stringify(failedRequests.slice(0,5))+" ORIGINAL="+e.message.slice(0,220));
 }
 if(!await order.isVisible()){
  const nav=page.locator('.cabinet-sidebar nav a[href="#create-request"]').first();
  if(await nav.count())await nav.evaluate(el=>el.click());
  else await page.evaluate(()=>{location.hash="#create-request";window.dispatchEvent(new HashChangeEvent("hashchange"))});
 }
 try{await order.waitFor({state:"visible",timeout:4500})}catch(e){
   const state=await page.evaluate(()=>({
     hash:location.hash,
     nav:[...document.querySelectorAll('.cabinet-sidebar nav a')].map(x=>({href:x.getAttribute('href'),current:x.getAttribute('aria-current')})).filter(x=>x.href==="#create-request"),
     panels:[...document.querySelectorAll('.cabinet-panel[data-section="create-request"]')].map(x=>({hidden:x.hidden,display:getComputedStyle(x).display,outer:x.outerHTML.slice(0,280)})),
     body:(document.body?.innerText||"").slice(0,550)
   }));
   await page.screenshot({path:"reports/t1-01-hidden-form.png",fullPage:true}).catch(()=>{});
   throw Error("Owner form hidden after sidebar click. STATE="+JSON.stringify(state)+" ERRORS="+JSON.stringify(errors.slice(0,5))+" ORIGINAL="+e.message.slice(0,150));
 }
 return {page,posted,errors,order};
}
const input=(page,label)=>{
 const root=page.locator(".cabinet-panel[data-section='create-request']");
 const selectors={
  "Краткое описание":'input[placeholder^="Что перевозим"]',
  "Контакт отправителя":'input[placeholder^="Имя, телефон"]',
  "Пункт погрузки":'input[placeholder^="Страна, город, адрес склада"]',
  "Вес брутто, кг":'input[placeholder^="Например, 1250"]',
  "Конечная точка прибытия":'input[placeholder^="Страна, город, адрес доставки"]',
  "Условия перевозки · Incoterms":'fieldset.request-owner-fields select',
  "Дата готовности":'fieldset.request-owner-fields input[type=date]',
  "Объём, м³":'input[placeholder^="Например, 8,4"]',
  "Груз":'input[placeholder^="Наименование, упаковка"]',
  "Ставки принимаются до":'fieldset.request-owner-fields input[type=datetime-local]'
 };
 const selector=selectors[label];
 if(!selector)throw Error("T1-01 selector missing for "+label);
 return root.locator(selector).first();
};

test("T1-01 isolated browser: empty order and deadline cannot publish",async(t)=>{
 const {page,order,errors}=await fixture(t);
 const button=page.getByRole("button",{name:"Опубликовать и уведомить перевозчиков"});
 assert.equal(await button.isEnabled(),false,"Publish was enabled for an empty request");
 await order.fill("QA-T101-VALIDATION");
 assert.equal(await button.isEnabled(),false,"Publish was enabled without deadline");
 assert.deepEqual(errors,[],"JavaScript errors in Owner form");
});
test("T1-01 isolated browser: invalid mandatory shipment data must not be publishable",async(t)=>{
 const {page,order}=await fixture(t);
 const button=page.getByRole("button",{name:"Опубликовать и уведомить перевозчиков"});
 await order.fill("QA-T101-NEGATIVE");
 await input(page,"Ставки принимаются до").fill("2027-06-15T12:00");
 // This is a negative test: filling only number+deadline is insufficient.
 // It intentionally fails if real UI enables publication with no cargo, route, readiness or volume.
 assert.equal(await button.isEnabled(),false,
  "T1-01 DEFECT: publication enabled without cargo, origin, destination, ready date and volume");
});
test("T1-01 isolated browser: complete shipment preserves data in publication request",async(t)=>{
 const {page,order,posted,errors}=await fixture(t);
 await order.fill("QA-T101-COMPLETE");
 await page.waitForTimeout(700); // Allow request lookup to settle without hiding the form.
 const summaryField=input(page,"Краткое описание");
 try {
   await summaryField.waitFor({state:"visible",timeout:7000});
 } catch(e) {
   const state=await page.evaluate(()=>({hash:location.hash,body:(document.body?.innerText||"").slice(0,650),
     panel:[...document.querySelectorAll('.cabinet-panel[data-section="create-request"]')].map(p=>({hidden:p.hidden,fieldset:p.querySelector("fieldset.request-owner-fields")?.outerHTML.slice(0,300)})),
     requestFields:[...document.querySelectorAll("fieldset.request-owner-fields input")].map(x=>x.getAttribute("placeholder")).slice(0,12)}));
   await page.screenshot({path:"reports/t1-01-positive-form-not-found.png",fullPage:true}).catch(()=>{});
   throw Error("T1-01 OWNER_FORM_FIELDS_MISSING_AFTER_ORDER "+JSON.stringify({state,jsErrors:errors.slice(-8)}).slice(0,2100));
 }
 // Bitrix multi-task field is exercised separately in T1-05; keep this T1-01 scenario focused on required shipment data.
 await input(page,"Краткое описание").fill("QA isolated form test");
 await input(page,"Контакт отправителя").fill("Test sender");
 await input(page,"Пункт погрузки").fill("Yiwu, China");
 await input(page,"Вес брутто, кг").fill("1250");
 await input(page,"Конечная точка прибытия").fill("Minsk, Belarus");
 await input(page,"Условия перевозки · Incoterms").selectOption("EXW");
 await input(page,"Дата готовности").fill("2027-06-05");
 await input(page,"Объём, м³").fill("12.5");
 await input(page,"Груз").fill("QA packaged cargo");
 await input(page,"Ставки принимаются до").fill("2027-06-15T12:00");
 const publish=page.getByRole("button",{name:"Опубликовать и уведомить перевозчиков"});
 await page.locator("fieldset.request-owner-fields select").nth(1).selectOption("yes");
 assert.equal(await publish.isEnabled(),false,"Dangerous goods yes without details must stay disabled");
 await page.locator('input[placeholder^="UN номер"]').fill("UN3481, Class 9, QA test only");
 assert.equal(await publish.isEnabled(),true,"Complete request must enable publication");
 await page.screenshot({path:"reports/t1-01-filled-owner-form.png",fullPage:true});
 await page.getByRole("button",{name:"Опубликовать и уведомить перевозчиков"}).click();
 await page.waitForFunction(()=>!!document.querySelector(".cabinet-panel[data-section='create-request'] .notice")?.textContent.includes("Опубликовано"),null,{timeout:12000}).catch(()=>{});
 const p=posted.find(x=>x.order==="QA-T101-COMPLETE");
 assert.ok(p,"Real React Owner form did not POST /api/requests");
 assert.equal(p.logistics.origin,"Yiwu, China");
 assert.equal(p.logistics.destination,"Minsk, Belarus");
 assert.equal(p.logistics.ready_date,"2027-06-05");
 assert.equal(p.logistics.incoterm,"EXW");
 assert.equal(p.logistics.cargo,"QA packaged cargo");
 assert.equal(p.logistics.volume,"12.5");
 assert.equal(p.logistics.dangerous_goods,"yes");
 assert.match(p.logistics.dangerous_details,/UN3481/);
 assert.equal(p.deadline,"2027-06-15T12:00");
 assert.deepEqual(errors,[],"JavaScript errors in Owner form");
});
