import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve, extname} from "node:path";

const root=resolve("test"), MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml"};
const roles=["owner","carrier","logistic","supplier","content","designer","purchasing","certification"];
function appServer(){return createServer(async(req,res)=>{
 const pathname=new URL(req.url,"http://localhost").pathname;
 const file=resolve("."+ (pathname==="/test/"?"/test/index.html":pathname));
 if(!file.startsWith(root+"/")){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{"Content-Type":MIME[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(await readFile(file))}
 catch{res.writeHead(404);res.end("Not found")}
})}
async function withBrowser(t,role,viewport={width:1366,height:900}){
 const server=appServer();
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const browser=await chromium.launch({headless:true});
 t.after(async()=>{await browser.close();await new Promise(done=>server.close(done))});
 const context=await browser.newContext({viewport});
 const page=await context.newPage();
 const errors=[],requests=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",e=>{if(e.type()==="error")errors.push(e.text().slice(0,500))});
 const respond=(route,status,body)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body),headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
 await page.route("https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/**",async route=>{
   const req=route.request(),path=new URL(req.url()).pathname.split("/freight-api")[1]||"";
   requests.push({path,method:req.method()});
   if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
   if(path==="/api/test-cabinets")return respond(route,200,{environment:"staging",presets:[],users:[]});
   if(path==="/api/session")return respond(route,200,{role});
   if(path==="/api/access")return respond(route,200,{access:{owner:role==="owner",permissions:role==="owner"?["workspace.read","requests.manage","reports.read","documents.read"]:["workspace.read","requests.read","documents.read"]},users:[],profiles:[],roles:[],roleProfiles:[]});
   if(path==="/api/workload")return respond(route,200,{total:0,requests:0,shipments:0,categories:[],counts:{deliveries:0,incidents:0},items:[]});
   if(path==="/api/data")return respond(route,200,{role,bids:[],answers:[],selections:[],reports:[],approvals:[],notifications:[],requests:[]});
   if(path==="/api/carrier")return respond(route,200,{role,items:[],bids:[],notifications:[],answers:[],tasks:[],user:{role},carrierPolicy:{blocked:false,level:90}});
   if(path==="/api/requests"&&req.method()==="GET")return respond(route,404,{error:"QA synthetic: no request"});
   return respond(route,200,{role,items:[],bids:[],rounds:[],tasks:[],orders:[],notifications:[],rows:[],results:[],claims:[],total:0});
 });
 await page.goto("http://127.0.0.1:"+server.address().port+"/test/",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(900);
 return {page,errors,requests};
}
test("ROBOT-OWNER isolated Owner can open canonical New Shipment form",async t=>{
 const {page,errors}=await withBrowser(t,"owner");
 const nav=page.locator('.cabinet-sidebar nav a[href="#create-request"]');
 await nav.first().waitFor({timeout:10000});
 await nav.first().click();
 await page.locator('input[aria-label="Номер заказа *"]').waitFor({state:"visible",timeout:10000});
 assert.equal(await page.locator('input[aria-label="Номер заказа *"]').count(),1);
 assert.ok(await page.getByRole("button",{name:"Опубликовать и уведомить перевозчиков"}).count()>0);
 assert.deepEqual(errors,[],"Owner JavaScript errors");
});
test("ROBOT-CARRIER isolated Carrier has own workspace and cannot open Owner creation",async t=>{
 const {page,errors}=await withBrowser(t,"carrier");
 await page.locator(".cabinet-sidebar nav").waitFor({timeout:10000});
 assert.equal(await page.locator('.cabinet-sidebar nav a[href="#create-request"]').count(),0,"Carrier should not see Owner creation");
 assert.ok(await page.locator('.cabinet-sidebar nav a[href="#carrier-orders"]').count()>0,"Carrier requests workspace missing");
 assert.ok(await page.locator('.cabinet-sidebar nav a[href="#carrier-offers"]').count()>0,"Carrier offers workspace missing");
 await page.locator('.cabinet-sidebar nav a[href="#carrier-orders"]').click();
 const panel=page.locator('.cabinet-panel[data-section="carrier-orders"]');
 await panel.waitFor({state:"visible",timeout:10000});
 assert.deepEqual(errors,[],"Carrier JavaScript errors");
});
test("ROBOT-VED isolated VED cannot access Owner request creation controls",async t=>{
 const {page,errors}=await withBrowser(t,"logistic");
 await page.locator(".cabinet-sidebar nav").waitFor({timeout:10000});
 assert.equal(await page.locator('.cabinet-sidebar nav a[href="#create-request"]').count(),0);
 assert.equal(await page.locator('input[aria-label="Номер заказа *"]').count(),0);
 assert.deepEqual(errors,[],"VED JavaScript errors");
});
test("ROBOT-MOBILE isolated Carrier workspace fits 390px viewport",async t=>{
 const {page}=await withBrowser(t,"carrier",{width:390,height:844});
 await page.locator(".cabinet-app").waitFor({timeout:10000});
 const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(sizes.scroll<=sizes.viewport+3,JSON.stringify(sizes));
});
