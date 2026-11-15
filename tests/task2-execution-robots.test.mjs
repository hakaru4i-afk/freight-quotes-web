import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";

const appJs=await readFile("test/task2-panel-sidebar-only-20261107.js"),appCss=Buffer.concat([await readFile("test/task2.css"),await readFile("test/task2-execution-layout-20261114.css")]);
const HTML='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/task2.css"><div class="cabinet-panel" data-section="approved-shipments"></div><script src="/task2.js"></script></html>';
async function fixture(t,{role="carrier",mode="Авто",container="",deliveryDays,baseline=false}={}){
 const order="QA-ROBOT-ROUTE-001",posts=[];
 const shipment={order_code:order,registration_no:"TR-26-000101",bitrix_task:"5316,5324",carrier_login:"carrier-qa",delivery_days:deliveryDays,mode,route:"Yiwu → Minsk",origin:"Yiwu",destination:"Minsk",weight:1250,volume:12.5,cargo:"Mock cargo",amount:700,currency:"USD",pickup:"2026-11-07T10:00:00Z"};
 const state={status:"in_progress",original_departure:"2026-11-07T10:00:00Z",actual_departure:null,pto_at:null,pto_checked_at:null,customs_at:null,warehouse_at:null};
 const detail={role,shipment,state,plans:baseline?[{is_baseline:true,planned_departure:state.original_departure,reason:"approved_offer"}]:[],points:[],tasks:[],containers:container?[{container_no:container}]:[],docs:[],events:[],acts:[],route:null,hasClaim:false};
 const send=(res,obj,code=200)=>{res.writeHead(code,{"content-type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(obj))};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/fixture"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(HTML);return}
  if(url.pathname==="/task2.css"){res.writeHead(200,{"content-type":"text/css; charset=utf-8"});res.end(appCss);return}
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
    if(fields.pto_yes&&!state.pto_at){state.pto_at=fields.pto_date;/* VED review is assigned before PTO, not by arrival. */}
    if(fields.customs_date)state.customs_at=fields.customs_date;
    if(fields.container_no)detail.containers=[{container_no:fields.container_no}];
    if(fields.location)detail.points.push({location_text:fields.location,observed_at:fields.location_date,comment:fields.location_comment||""});
    return send(res,{ok:true});
  }
  if(payload.action==='final_cost_submit'){
    state.final_cost_amount=Number(payload.amount).toFixed(2);state.final_cost_currency=payload.currency;state.final_cost_revision=Number(state.final_cost_revision||0)+1;state.final_cost_confirmed_at=null;state.final_cost_confirmed_by=null;return send(res,{ok:true});
  }
  if(payload.action==='final_cost_confirm'){state.final_cost_confirmed_at='2026-11-15T00:00:00Z';state.final_cost_confirmed_by='owner';return send(res,{ok:true});}
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
async function save(page,kind="save"){
 const form=page.locator(`form[data-t2-form="${kind}"]`).first();
 await form.locator('button[type="submit"]').click();
 await page.waitForTimeout(150);
}
test("T2-17 ROBOT: planning date change needs a reason and keeps original date",async t=>{
 const {page,posts,detail,errors}=await fixture(t);
 const form=page.locator('form[data-t2-form="plan"]');
 await form.locator('input[name="new_plan_date"]').fill("2027-06-06T09:00");
 await save(page,"plan");
 assert.equal(posts.length,0,"Missing reason should not post");
 assert.equal(await form.locator('[name="new_plan_reason"]').evaluate(e=>e.validity.valueMissing),true);
 await form.locator('input[name="new_plan_reason"]').fill("Ship ready later");
 await save(page,"plan");
 assert.equal(posts.filter(x=>x.action==="save").length,1);
 assert.equal(detail.plans.length,1);
 assert.equal(detail.plans[0].reason,"Ship ready later");
 assert.equal(detail.state.original_departure,"2026-11-07T10:00:00Z");
 assert.deepEqual(errors,[]);
});
test("T2-18 ROBOT: auto, rail, sea and air execution render without transport application",async t=>{
 for(const mode of ["Авто","Ж/Д","Море","Авиа"]){
  const {page,errors}=await fixture(t,{mode});
  assert.match(await page.locator("#task2-root").innerText(),/Перевозка принята в работу/);
  assert.ok((await page.locator('#task2-root [data-t2-section="overview"]').innerText()).includes(mode),mode+" transport missing");
  assert.ok(await page.locator('form[data-t2-form="save"]').count()>0,mode+" execution blocked");
  assert.deepEqual(errors,[],mode+" execution errors");
 }
});
test("T2-20 ROBOT: PТО arrival preserves the previously completed VED review",async t=>{
 const {page,posts,detail}=await fixture(t);
 detail.state.pto_checked_at="2026-11-07T12:00:00Z";
 const form=page.locator('form[data-t2-form="save"]');
 await form.locator('select[name="pto_yes"]').selectOption("yes");
 await form.locator('input[name="pto_date"]').fill("2027-06-19T10:00");
 await save(page);
 const event=posts.find(x=>x.action==="save");
 assert.equal(event.fields.pto_yes,true);
 assert.equal(detail.tasks.filter(x=>x.task_type==="pto_review").length,0,"Arrival must not duplicate the earlier VED review");
 assert.ok(detail.state.pto_at);
});
test("T2-21 ROBOT: container is optional during tracking, can be added later",async t=>{
 const {page,posts,detail}=await fixture(t);
 assert.equal(detail.containers.length,0);
 assert.equal(await page.locator('form[data-t2-form="container"]').count(),1);
 const form=page.locator('form[data-t2-form="container"]');
 await form.locator('input[name="container_no"]').fill("MSCU1234567");
 await save(page,"container");
 assert.equal(posts.find(x=>x.action==="save").fields.container_no,"MSCU1234567");
 assert.equal(detail.containers.length,1);
 await page.reload();
 await page.locator('#task2-root .t2-context').waitFor();
 assert.match(await page.locator('.t2-container-existing').innerText(),/MSCU1234567/);
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
test("T2-23 ROBOT: unapproved claims and acts remain unavailable for every role",async t=>{
 for(const role of ["owner","carrier","ved","logistic"]){
  const {page,posts,errors}=await fixture(t,{role,mode:"Море"});
  assert.equal(await page.locator('form[data-t2-form="act"]').count(),0);
  assert.equal(await page.locator('[data-t2-section="claims"]').count(),0);
  assert.equal(posts.length,0);
  assert.deepEqual(errors,[]);
 }
});

test("weekly tracking accepts numeric and localized string delivery days",async t=>{
 for(const deliveryDays of [21,"21","21 days","21 дней"]){
  const {page}=await fixture(t,{deliveryDays});
  const tracking=await page.locator('[data-t2-section="track"]').innerText();
  assert.match(tracking,/Плановый срок: 21 дн/);
  assert.match(tracking,/Контрольных недель: 3/);
  assert.doesNotMatch(tracking,/Срок доставки в днях не указан/);
 }
});

test("original plan baseline is preserved and does not consume a reschedule row",async t=>{
 const {page,detail}=await fixture(t,{baseline:true});
 assert.equal(await page.locator('.t2-plan-four-row.is-saved').count(),0);
 assert.equal(await page.locator('form[data-t2-form="plan"]').count(),1);
 const form=page.locator('form[data-t2-form="plan"]');
 await form.locator('[name="new_plan_date"]').fill('2027-06-06T09:00');
 await form.locator('[name="new_plan_reason"]').fill('QA delayed pickup');
 await save(page,'plan');
 assert.equal(detail.plans.length,2);
 assert.equal(detail.plans[0].is_baseline,true);
 assert.equal(await page.locator('.t2-plan-four-row.is-saved').count(),1);
 assert.match(await page.locator('form[data-t2-form="plan"]').innerText(),/Перенос 2/);
});


test('final settlement UI: Carrier sends numeric revision and original currency; Owner controls stay absent',async t=>{
 const{page,posts,state}=await fixture(t,{role:'carrier'});Object.assign(state,{warehouse_at:'2026-11-14T00:00:00Z',actual_departure:'2026-11-01T00:00:00Z',pto_at:'2026-11-12T00:00:00Z',pto_checked_at:'2026-11-11T00:00:00Z',customs_at:'2026-11-13T00:00:00Z'});await page.locator('[data-t2-refresh]').click();const form=page.locator('[data-t2-form="final_cost_submit"]');await form.waitFor();assert.equal(await page.locator('[data-t2-form="final_cost_confirm"]').count(),0);assert.equal(await form.locator('[name="currency"]').isEditable(),false);await form.locator('[name="amount"]').fill('7950.50');await form.getByRole('button',{name:'Отправить итоговую сумму владельцу',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.t2-final-cost')?.textContent.includes('7950.50 USD'));const command=posts.find(x=>x.action==='final_cost_submit');assert.equal(command.expectedRevision,0);assert.equal(command.amount,'7950.50');assert.equal(command.currency,'USD');assert.equal(command.confirmedBy,undefined);assert.match(await page.locator('.t2-final-cost').innerText(),/Ожидает подтверждения/);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));
});
test('final settlement UI: Owner approves the displayed exact amount without a Carrier editor',async t=>{
 const{page,posts,state}=await fixture(t,{role:'owner'});Object.assign(state,{warehouse_at:'2026-11-14T00:00:00Z',final_cost_amount:'7950.50',final_cost_currency:'USD',final_cost_revision:1,final_cost_submitted_at:'2026-11-14T01:00:00Z',final_cost_submitted_by:'carrier-qa'});await page.locator('[data-t2-refresh]').click();const form=page.locator('[data-t2-form="final_cost_confirm"]');await form.waitFor();assert.equal(await page.locator('[data-t2-form="final_cost_submit"]').count(),0);assert.match(await page.locator('.t2-final-cost').innerText(),/7950.50 USD/);await form.getByRole('button',{name:'Подтвердить итоговую сумму',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.t2-final-cost')?.textContent.includes('Подтверждено'));const command=posts.find(x=>x.action==='final_cost_confirm');assert.equal(command.expectedRevision,1);assert.equal(command.amount,'7950.50');assert.equal(command.currency,'USD');assert.equal(command.confirmedAt,undefined);
});

test('claim UI sends revision-bound decisions and preserves readable proposal details',async t=>{
 const{page,posts,detail,state}=await fixture(t,{role:'owner'});
 state.warehouse_at='2026-11-14T00:00:00Z';detail.hasClaim=true;
 detail.claim={id:'claim-ui',revision:4,state:'negotiation',data:{circumstances:'Synthetic existing shipment discrepancy',settlementStatus:'proposed',proposal:{revision:2,method:'compensation',plan:'Synthetic agreed compensation in the shipment currency',deadline:'2027-01-10'}}};
 await page.locator('[data-t2-refresh]').click();const form=page.locator('[data-t2-form="claim_command"]');await form.waitFor();assert.match(await page.locator('.t2-claim-notice').innerText(),/Synthetic agreed compensation/);assert.match(await page.locator('.t2-claim-notice').innerText(),/2027-01-10/);assert.equal(await page.locator('[data-t2-form="claim_close"]').count(),0);await form.locator('[name="note"]').fill('Synthetic Owner review of the exact Carrier proposal');await form.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#task2-root')?.getAttribute('aria-busy')==='false');const p=posts.find(x=>x.action==='claim_approve');assert.ok(p);assert.equal(p.claimRevision,4);assert.equal(p.proposalRevision,2);assert.equal(p.actor,undefined);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));
});
test('claim UI only offers the Carrier own evidence uploaded after approval',async t=>{
 const{page,posts,detail,state}=await fixture(t,{role:'carrier'});state.warehouse_at='2026-11-14T00:00:00Z';detail.hasClaim=true;detail.claim={id:'claim-ui',revision:5,state:'negotiation',data:{settlementStatus:'approved',review:{at:'2026-11-15T08:00:00Z'},proposal:{revision:2,plan:'Synthetic existing resolution',deadline:'2027-01-10'}}};detail.docs=[{id:'owner-file',name:'Owner evidence',actor:'owner',created:'2026-11-15T08:01:00Z'},{id:'old-file',name:'Earlier carrier file',actor:'carrier-qa',created:'2026-11-14T08:00:00Z'},{id:'fresh-file',name:'Carrier fulfilment',actor:'carrier-qa',created:'2026-11-15T08:01:00Z'}];await page.locator('[data-t2-refresh]').click();const form=page.locator('[data-t2-form="claim_command"]');await form.waitFor();assert.deepEqual(await form.locator('[name="proofId"] option').evaluateAll(xs=>xs.map(x=>x.value)),['','fresh-file']);await form.locator('[name="proofId"]').selectOption('fresh-file');await form.locator('[name="note"]').fill('Synthetic Carrier evidence of the approved resolution');await form.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#task2-root')?.getAttribute('aria-busy')==='false');const p=posts.find(x=>x.action==='claim_fulfill');assert.equal(p.proofId,'fresh-file');assert.equal(p.proposalRevision,2);assert.equal(p.claimRevision,5);assert.equal(await page.locator('[data-t2-form="claim_close"]').count(),0);
});
