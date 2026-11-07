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
  if(path==="/api/session")return respond(200,{role:"owner"});
  if(path==="/api/access")return respond(200,{access:{owner:true,permissions:["workspace.read","requests.manage","documents.read"]},users:[],roles:[],profiles:[],roleProfiles:[]});
  if(path==="/api/data")return respond(200,{role:"owner",bids:[],answers:[],selections:[],reports:[],approvals:[],notifications:[],requests:[]});
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
  const nav=page.locator('a[href="#create-request"],button[data-section="create-request"]').first();
  if(await nav.count())await nav.click();
  else await page.evaluate(()=>window.dispatchEvent(new HashChangeEvent("hashchange")));
 }
 await order.waitFor({state:"visible",timeout:20000});
 return {page,posted,errors,order};
}
const input=(page,label)=>page.locator(".cabinet-panel[data-section='create-request'] label").filter({hasText:label}).locator("input,textarea,select").first();
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
 await input(page,"№ задач Битрикс").fill("5316, 5324, 5325");
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
 assert.equal(p.bitrixTask,"5316, 5324, 5325");
 assert.equal(p.deadline,"2027-06-15T12:00");
 assert.deepEqual(errors,[],"JavaScript errors in Owner form");
});
