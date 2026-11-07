import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";

const appJs=await readFile("test/task2-panel-sidebar-only-20261107.js");
const HTML='<!doctype html><html lang="ru"><meta charset="utf-8"><div class="cabinet-panel" data-section="approved-shipments"></div><script src="/task2.js"></script></html>';
async function fixture(t,{role="carrier",mode="Авто",container=""}={}){
 const order="QA-ROBOT-ROUTE-001",posts=[];
 const shipment={order_code:order,registration_no:"TR-26-000101",bitrix_task:"5316,5324",carrier_login:"carrier-qa",mode,route:"Yiwu → Minsk",origin:"Yiwu",destination:"Minsk",weight:1250,volume:12.5,cargo:"Mock cargo",amount:700,currency:"USD",pickup:"2026-11-07T10:00:00Z"};
 const state={status:"in_progress",original_departure:"2026-11-07T10:00:00Z",actual_departure:null,pto_at:null,pto_checked_at:null,customs_at:null,warehouse_at:null};
 const detail={role,shipment,state,plans:[],points:[],tasks:[],containers:container?[{container_no:container}]:[],docs:[],events:[],acts:[],route:null,hasClaim:false};
 const send=(res,obj,code=200)=>{res.writeHead(code,{"content-type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(obj))};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/fixture"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(HTML);return}
  if(url.pathname==="/task2.js"){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8"});res.end(appJs);return}
  if(url.pathname!=="/api/task2"){send(res,{error:"Not found"},404);return}
  if(req.method==="GET"){
    if(!url.searchParams.has("order"))return send(res,{role,items:[{order_code:order,registration_no:shipment.registration_no,process_status:state.status}]});
    return send(res,detail);
  }
  let raw="";for await(const chunk of req)raw+=chunk;
  let payload;try{payload=JSON.parse(raw)}catch{return send(res,{error:"Invalid payload"},400)}
  posts.push(payload);
  if(payload.action==="save"){
    const fields=payload.fields||{};
    if(fields.new_plan_date)detail.plans.push({planned_departure:fields.new_plan_date,reason:fields.new_plan_reason||""});
    if(fields.actual_departure)state.actual_departure=fields.actual_departure;
    if(fields.pto_yes&&!state.pto_at){state.pto_at=fields.pto_date;detail.tasks.push({id:"pto-1",status:"open",task_type:"pto_review",description:"Check PТО",inherited_bitrix_tasks:shipment.bitrix_task})}
    if(fields.customs_date)state.customs_at=fields.customs_date;
    if(fields.container_no)detail.containers=[{container_no:fields.container_no}];
    if(fields.location)detail.points.push({location_text:fields.location,observed_at:fields.location_date,comment:fields.location_comment||""});
    return send(res,{ok:true});
  }
  if(payload.action==="finish"){
    if(!payload.answer&&!detail.containers.length)return send(res,{ok:true,needsContainerDecision:true});
    if(payload.answer==="yes")return send(res,{ok:true,waitingContainer:true});
    state.status="completed";return send(res,{ok:true,finished:true});
  }
  if(payload.action==="act_send"||payload.action==="act_create"){
    detail.acts.unshift({id:"act-1",transport:"auto",revision:1,state:payload.action==="act_send"?"sent":"draft",data:payload.data||{},created_at:new Date().toISOString()});
    detail.hasClaim=true;return send(res,{ok:true});
  }
  if(payload.action==="complete_task"){const task=detail.tasks.find(x=>x.id===payload.taskId);if(task)task.status="completed";state.pto_checked_at=new Date().toISOString();return send(res,{ok:true})}
  return send(res,{ok:true});
 });
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true});
 t.after(async()=>{await browser.close();await new Promise(ok=>server.close(ok))});
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 page.on("dialog",d=>d.dismiss());
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/fixture",{waitUntil:"load"});
 await page.locator("#task2-root .t2-context").waitFor({timeout:12000});
 return {page,posts,detail,state,errors};
}
async function save(page){
 const form=page.locator('form[data-t2-form="save"]');
 await form.locator('button[type="submit"]').click();
 await page.waitForTimeout(150);
}
test("T2-17 ROBOT: planning date change needs a reason and keeps original date",async t=>{
 const {page,posts,detail,errors}=await fixture(t);
 const form=page.locator('form[data-t2-form="save"]');
 await form.locator('input[name="new_plan_date"]').fill("2027-06-06T09:00");
 await save(page);
 assert.equal(posts.length,0,"Missing reason should not post");
 assert.match(await page.locator("#t2-alert").innerText(),/причину переноса/i);
 await form.locator('textarea[name="new_plan_reason"]').fill("Ship ready later");
 await save(page);
 assert.equal(posts.filter(x=>x.action==="save").length,1);
 assert.equal(detail.plans.length,1);
 assert.equal(detail.plans[0].reason,"Ship ready later");
 assert.equal(detail.state.original_departure,"2026-11-07T10:00:00Z");
 assert.deepEqual(errors,[]);
});
test("T2-18 ROBOT: all four carrier modes are visible in execution without transport application",async t=>{
 const {page,detail,errors}=await fixture(t,{mode:"Авиа"});
 assert.match(await page.locator("#task2-root").innerText(),/Перевозка принята в работу/);
 assert.match(await page.locator('#task2-root [data-t2-section="overview"]').innerText(),/Авиа/);
 assert.ok(await page.locator('form[data-t2-form="save"]').count()>0,"Execution must be available without approved transport application");
 assert.deepEqual(errors,[]);
});
test("T2-20 ROBOT: PТО creates one VED review task on event submission",async t=>{
 const {page,posts,detail}=await fixture(t);
 const form=page.locator('form[data-t2-form="save"]');
 await form.locator('select[name="pto_yes"]').selectOption("yes");
 await form.locator('input[name="pto_date"]').fill("2027-06-19T10:00");
 await save(page);
 const event=posts.find(x=>x.action==="save");
 assert.equal(event.fields.pto_yes,true);
 assert.equal(detail.tasks.filter(x=>x.task_type==="pto_review").length,1);
 assert.ok(detail.state.pto_at);
});
test("T2-21 ROBOT: container is optional during tracking, can be added later",async t=>{
 const {page,posts,detail}=await fixture(t);
 assert.match(await page.locator('#task2-root [data-t2-section="track"]').innerText(),/продолжение работы разрешено/);
 const form=page.locator('form[data-t2-form="save"]');
 await form.locator('input[name="container_no"]').fill("MSCU1234567");
 await save(page);
 assert.equal(posts.find(x=>x.action==="save").fields.container_no,"MSCU1234567");
 assert.equal(detail.containers.length,1);
});
test("T2-22 ROBOT: carrier cannot close; Owner can finish without container after explicit decision",async t=>{
 const carrier=await fixture(t,{role:"carrier"});
 assert.equal(await carrier.page.locator('[data-t2-action="finish"]').count(),0,"Carrier has an unauthorized completion button");
 const owner=await fixture(t,{role:"owner"});
 await owner.page.locator('[data-t2-action="finish"]').click();
 await owner.page.waitForTimeout(200);
 assert.equal(owner.posts.filter(x=>x.action==="finish").length,2);
 assert.equal(owner.posts.at(-1).answer,"no");
 assert.equal(owner.state.status,"completed");
});
test("T2-23 ROBOT: Owner claim form submits a mode-specific act",async t=>{
 const {page,posts,detail}=await fixture(t,{role:"owner",mode:"Море"});
 const f=page.locator('form[data-t2-form="act"]');
 assert.match(await f.innerText(),/№ коносамента B\/L/);
 await f.locator('textarea[name="description"]').fill("Damaged mock cargo");
 await f.locator('input[name="bill"]').fill("BOL-ROBOT-42");
 await f.locator('button[type="submit"]').click();
 await page.waitForTimeout(200);
 const act=posts.find(x=>x.action==="act_send");
 assert.ok(act,"Act was not sent through the correct endpoint");
 assert.equal(act.data.bill,"BOL-ROBOT-42");
 assert.equal(detail.acts.length,1);
});
