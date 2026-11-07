#!/usr/bin/env node
/**
 * AUTHENTICATED STAGING BROWSER JOURNEY, isolated QA database ONLY.
 * Creates a QA request, submits a real carrier quotation, attempts
 * Owner selection and Carrier execution through the published frontend.
 * Never routes writes to shared staging or production.
 * The CI report MUST NOT turn failures or missing secrets into PASS.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const PUBLIC_SITE = "https://hakaru4i-afk.github.io/freight-quotes-web/test/";
const QA_ORIGIN = "https://ibclzdkxiozbzmniiygv.supabase.co";
const QA_BASE = QA_ORIGIN + "/functions/v1/freight-api-qa-issue47qa";
const ROUTED_BASE = QA_ORIGIN + "/functions/v1/freight-api/";
const reportFile = "reports/task12-private-real-business-journey.json";
const runId = process.env.GITHUB_RUN_ID || randomUUID().slice(0,8);
const order = ("QA-E2E-" + runId + "-" + randomUUID().slice(0,6)).slice(0,50);
const users = {
  owner: {login:process.env.QA_OWNER_LOGIN, password:process.env.QA_OWNER_PASSWORD},
  carrierA: {login:process.env.QA_CARRIER_A_LOGIN, password:process.env.QA_CARRIER_A_PASSWORD},
  carrierB: {login:process.env.QA_CARRIER_B_LOGIN, password:process.env.QA_CARRIER_B_PASSWORD}
};
const report = {version:1, mode:"REAL_BROWSER_ISOLATED_QA", authorized:false,
  sourceSite:PUBLIC_SITE, qaFunction:"freight-api-qa-issue47qa",
  runId:process.env.GITHUB_RUN_ID||null, frontendCommit:process.env.GITHUB_SHA||null,
  createdAt:new Date().toISOString(), order, result:"BLOCKED", steps:[], apiCalls:0, writesToSharedStaging:0};
const step = async(name,fn) => {
  const rec = {name,status:"RUNNING",startedAt:new Date().toISOString()};
  report.steps.push(rec);
  try{const result=await fn();rec.status="PASS";rec.evidence=result||{};return result;}
  catch(e){rec.status="FAIL";rec.errorCode=(e.code||e.name||"JOURNEY_FAILED").toString().slice(0,80);rec.message=String(e.message||e).slice(0,650);throw e;}
  finally{rec.finishedAt=new Date().toISOString();}
};
const clean = s => String(s||"").replace(/(password|token|cookie|authorization)[=:][^\s]+/ig,"$1=[REDACTED]").slice(0,500);
const qaUrl = url => {
  const u = new URL(url);
  if(u.origin!==QA_ORIGIN || !u.pathname.startsWith("/functions/v1/freight-api-qa-issue47qa/"))
    throw Error("QA_ENDPOINT_ISOLATION_FAILED");
  return u;
};
async function checkHealth(){
  const r=await fetch(QA_BASE+"/health",{headers:{"Cache-Control":"no-store"},signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200,"QA_HEALTH_NOT_200");
  const x=await r.json();
  assert.equal(x.projectRef,"ibclzdkxiozbzmniiygv","QA_PROJECT_MISMATCH");
  assert.equal(x.qaRun,"issue47qa","QA_FUNCTION_ISOLATION_MISMATCH");
  return {health:200,qaRun:x.qaRun,apiVersion:x.apiVersion||x.version||null};
}
async function openRole(browser,actor){
  const u=users[actor],context=await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true});
  await context.route("**/*",async route=>{
    const requested=route.request().url();
    if(/^(data:|blob:|about:)/.test(requested))return route.continue();
    let u;try{u=new URL(requested)}catch{throw Error("INVALID_BROWSER_URL")}
    if(u.origin===QA_ORIGIN&&u.pathname.startsWith("/functions/v1/freight-api/")){
      const destination=QA_BASE+"/"+u.pathname.slice("/functions/v1/freight-api/".length)+u.search;
      qaUrl(destination);
      report.apiCalls++;
      // This is a same-origin rewrite (Supabase -> Supabase) to an isolated function.
      return route.continue({url:destination});
    }
    if(u.origin===QA_ORIGIN&&u.pathname.startsWith("/functions/v1/freight-api-qa-issue47qa/"))return route.continue();
    if(u.origin==="https://hakaru4i-afk.github.io"&&u.pathname.startsWith("/freight-quotes-web/test/"))return route.continue();
    if(u.origin==="https://fonts.googleapis.com"||u.origin==="https://fonts.gstatic.com")return route.continue();
    throw Error("UNSAFE_EXTERNAL_REQUEST_BLOCKED:"+u.hostname);
  });
  const page=await context.newPage();
  page.setDefaultTimeout(13000);
  await page.goto(PUBLIC_SITE,{waitUntil:"domcontentloaded",timeout:30000});
  const login=page.locator('input[name="login"]');
  await login.waitFor({state:"visible",timeout:16000});
  await login.fill(u.login);
  await page.locator('input[name="password"]').fill(u.password);
  const form=page.locator("form").filter({has:login});
  const signedIn=page.waitForResponse(r=>r.url().includes("/api/auth")&&r.request().method()==="POST",{timeout:20000});
  await form.getByRole("button",{name:/Войти|Вход|Login/i}).first().click();
  const response=await signedIn;
  assert.equal(response.status(),200,"LOGIN_FAILED_"+actor);
  await page.locator(".cabinet-sidebar nav").waitFor({state:"visible",timeout:14000});
  return {context,page};
}
async function enterOwnerShipment(page){
  await page.locator('.cabinet-sidebar nav a[href="#create-request"]').click();
  const panel=page.locator('.cabinet-panel[data-section="create-request"]');
  await panel.waitFor({state:"visible"});
  await panel.locator('input[aria-label="Номер заказа *"]').fill(order);
  const fields=panel.locator("fieldset.request-owner-fields");
  await fields.locator('input[placeholder^="Что перевозим"]').fill("QA automated end-to-end multimodal shipment");
  await fields.locator('input[placeholder^="Имя, телефон"]').fill("QA test sender (synthetic)");
  await fields.locator('input[placeholder^="Страна, город, адрес склада"]').fill("Yiwu, China");
  await fields.locator('input[placeholder^="Например, 1250"]').fill("1250");
  await fields.locator('input[placeholder^="Страна, город, адрес доставки"]').fill("Minsk, Belarus");
  await fields.locator("select").first().selectOption("EXW");
  await fields.locator('input[type="date"]').fill("2027-06-05");
  await fields.locator('input[placeholder^="Например, 8,4"]').fill("12.5");
  await fields.locator('input[placeholder^="Наименование, упаковка"]').fill("QA packaged cargo, 10 pallets");
  await fields.locator("select").nth(1).selectOption("no");
  await fields.locator('input[type="datetime-local"]').fill("2027-06-15T12:00");
  const publish=panel.getByRole("button",{name:/Опубликовать и уведомить/});
  assert.equal(await publish.isEnabled(),true,"OWNER_FORM_NOT_PUBLISHABLE");
  const written=page.waitForResponse(r=>r.url().includes("/api/requests")&&r.request().method()==="POST",{timeout:22000});
  await publish.click();
  const response=await written;
  const data=await response.json().catch(()=>({}));
  assert.equal(response.status(),200,"OWNER_PUBLISH_FAILED");
  assert.ok(data.round||data.ok||data.recipients>=0,"PUBLISH_RESPONSE_UNRECOGNIZED");
  return {httpStatus:response.status(),roundCreated:!!data.round,recipientCount:data.recipients??null};
}
async function makeCarrierBid(page,amount){
  await page.locator('.cabinet-sidebar nav a[href="#carrier-orders"]').first().click();
  await page.locator('.cabinet-panel[data-section="carrier-orders"]').waitFor({state:"visible"});
  const card=page.locator("article.carrier-request").filter({hasText:order}).first();
  await card.waitFor({state:"visible",timeout:14000});
  const link=card.locator('a[href*="quote"]').first();
  assert.equal(await link.count(),1,"CARRIER_QUOTE_LINK_MISSING");
  await link.click();
  const form=page.locator("form").filter({has:page.locator('input[name="carrier"]')});
  await form.locator('input[name="carrier"]').fill("QA CARRIER "+amount);
  await form.locator('input[name="contact"]').fill("Automated QA carrier");
  const v=form.locator("fieldset.quote-variant").first();
  await v.locator('input[aria-label="Общая ставка за партию"]').fill(String(amount));
  await v.locator('select[aria-label="Валюта"]').selectOption("USD");
  await v.locator('select[name$=".mode"]').selectOption({label:"Авто"});
  await v.locator('input[name$=".pickup"]').fill("2027-06-06");
  await v.locator('input[name$=".days"]').fill("35");
  await v.locator('input[name$=".incotermPlace"]').fill("Yiwu station, China");
  await v.locator('select[name$=".insurance"]').selectOption({label:"Включено"});
  await v.locator('input[name$=".validUntil"]').fill("2027-07-01");
  await v.locator('textarea[name$=".includes"]').fill("Pickup, transport, documents and delivery");
  await v.locator('textarea[name$=".extras"]').fill("No extras");
  await form.locator('input[type="checkbox"][required]').check();
  const written=page.waitForResponse(r=>r.url().includes("/api/quote")&&r.request().method()==="POST",{timeout:22000});
  await form.getByRole("button",{name:/Отправить все варианты/}).click();
  const response=await written;
  const x=await response.json().catch(()=>({}));
  assert.equal(response.status(),200,"CARRIER_QUOTE_FAILED");
  assert.ok(x.id||x.count>=1,"QUOTE_NOT_PERSISTED");
  return {httpStatus:response.status(),offerStored:!!x.id,variants:x.count||1,amount};
}
async function ownerChooseWinner(page){
  await page.locator('.cabinet-sidebar nav a[href="#offers"]').click();
  await page.locator('.cabinet-panel[data-section="offers"]').waitFor({state:"visible"});
  const card=page.locator(".cabinet-panel[data-section='offers']").getByText(order).first();
  await card.waitFor({state:"visible",timeout:14000});
  const button=page.getByRole("button",{name:"Выбрать этот вариант"}).first();
  assert.ok(await button.isVisible(),"OWNER_WINNER_BUTTON_MISSING");
  await button.click();
  const dialog=page.locator(".offer-selection-control").filter({hasText:"Выбрать"}).last();
  const confirm=dialog.getByRole("button",{name:/Подтвердить|Выбрать|Сохранить/}).last();
  const written=page.waitForResponse(r=>r.url().includes("/api/offer-selection")&&r.request().method()==="POST",{timeout:22000});
  await confirm.click();
  const response=await written;
  assert.equal(response.status(),200,"OWNER_WINNER_DECISION_FAILED");
  return {winnerStored:true,httpStatus:response.status()};
}
async function carrierTakeExecution(page){
  await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').click();
  const panel=page.locator('.cabinet-panel[data-section="approved-shipments"]');
  await panel.waitFor({state:"visible",timeout:12000});
  await panel.getByText(order).first().waitFor({state:"visible",timeout:15000});
  const take=panel.getByRole("button",{name:/Взять в работу/}).first();
  assert.ok(await take.isVisible(),"TAKE_INTO_WORK_BUTTON_MISSING");
  const written=page.waitForResponse(r=>(r.url().includes("/api/booking")||r.url().includes("/api/task2"))&&r.request().method()==="POST",{timeout:22000});
  await take.click();
  const response=await written;
  assert.equal(response.status(),200,"CARRIER_TAKE_FAILED");
  return {taken:true,httpStatus:response.status()};
}
async function carrierExecutionWithoutVed(page){
  await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().click();
  const panel=page.locator("#task2-root");
  await panel.locator('form[data-t2-form="save"]').waitFor({state:"visible",timeout:14000});
  // A forbidden VED dispatch must block the test BEFORE it can create that task.
  const vedControls=await panel.locator('option').filter({hasText:/создать задачу ВЭД/i}).count();
  assert.equal(vedControls,0,"UNAPPROVED_VED_DISPATCH_PRESENT_IN_EXECUTION");
  const form=panel.locator('form[data-t2-form="save"]');
  await form.locator('input[name="actual_departure"]').fill("2027-06-06T10:00");
  await form.locator('input[name="location"]').fill("Yiwu logistics hub");
  await form.locator('input[name="location_date"]').fill("2027-06-06T10:30");
  const saved=page.waitForResponse(r=>r.url().includes("/api/task2")&&r.request().method()==="POST",{timeout:22000});
  await form.locator('button[type="submit"]').click();
  const res=await saved;
  assert.equal(res.status(),200,"CARRIER_EXECUTION_SAVE_FAILED");
  return {trackingSaved:true,apiStatus:res.status(),vedDispatchPresent:false};
}
async function ownerReviewCompletion(page){
  await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().click();
  const root=page.locator("#task2-root");
  await root.getByText(order).first().waitFor({state:"visible",timeout:12000});
  const finish=root.locator('[data-t2-action="finish"]');
  assert.equal(await finish.count(),1,"OWNER_CLOSURE_ACTION_MISSING");
  const resPromise=page.waitForResponse(r=>r.url().includes("/api/task2")&&r.request().method()==="POST",{timeout:22000});
  await finish.click();
  const response=await resPromise;
  assert.equal(response.status(),200,"OWNER_CLOSE_BLOCKED_BY_INCOMPLETE_STAGES");
  return {completionAccepted:true,httpStatus:response.status()};
}
let browser;
try{
  await mkdir("reports",{recursive:true});
  const required=Object.entries(users).flatMap(([role,v])=>!v.login||!v.password?[role]:[]);
  if(required.length)throw Error("QA_ROLE_CREDENTIALS_NOT_CONFIGURED:"+required.join(","));
  await step("isolated_qa_health",checkHealth);
  browser=await chromium.launch({headless:true});
  const owner=await step("owner_login",()=>openRole(browser,"owner"));
  report.authorized=true;
  await step("owner_create_and_publish_real_request",()=>enterOwnerShipment(owner.page));
  const carrierA=await step("carrier_a_login",()=>openRole(browser,"carrierA"));
  await step("carrier_a_submit_real_quote",()=>makeCarrierBid(carrierA.page,1550));
  const carrierB=await step("carrier_b_login",()=>openRole(browser,"carrierB"));
  await step("carrier_b_submit_real_quote",()=>makeCarrierBid(carrierB.page,1780));
  await step("owner_choose_real_winner",()=>ownerChooseWinner(owner.page));
  await step("winning_carrier_take_into_work",()=>carrierTakeExecution(carrierA.page));
  await step("carrier_execution_without_ved_dispatch",()=>carrierExecutionWithoutVed(carrierA.page));
  await step("owner_attempt_completion",()=>ownerReviewCompletion(owner.page));
  // Further process gates need real authenticated browser flows:
  // route/tracking, document Storage SHA, delivery, claim, closure, rollback.
  // Deliberately NOT marked release-ready by this partial journey.
  report.result="PARTIAL";
} catch(err) {
  report.result=report.steps.some(x=>x.status==="FAIL")?"FAIL":"BLOCKED";
  report.blocker=clean(err?.message||err);
  console.error("REAL_JOURNEY",report.result,report.blocker);
} finally{
  if(browser)await browser.close().catch(()=>{});
  report.finishedAt=new Date().toISOString();
  await writeFile(reportFile,JSON.stringify(report,null,2)+"\n");
  console.log("REAL_JOURNEY_SUMMARY",JSON.stringify({result:report.result,steps:report.steps.map(x=>({name:x.name,status:x.status,errorCode:x.errorCode||null})),apiCalls:report.apiCalls,sharedStagingWrites:report.writesToSharedStaging}));
  if(report.result!=="PASS")process.exitCode=1;
}
