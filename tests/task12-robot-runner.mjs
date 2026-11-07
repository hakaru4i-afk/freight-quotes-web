#!/usr/bin/env node
/**
 * Task 1 + 2 QA robot coordinator.
 * Every mapped check is executed, never inferred from source-file existence.
 * A passing isolated/unit check does NOT mark an authenticated E2E PASS.
 * Writes only synthetic/public test outcomes, never credentials, customer data or session tokens.
 */
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {spawn} from "node:child_process";
import {basename} from "node:path";
const matrix=JSON.parse(await readFile("test/qa-observer.json","utf8"));
const raw=[...matrix.task1.cases,...matrix.task2.cases];
const mapping={
 "T1-01":["task1-create-form-browser.test.mjs"],
 "T1-02":["issue47-owner-cabinets.test.mjs"],
 "T1-03":["task12-role-robots.test.mjs","qa-anonymous-roles.test.mjs"],
 "T1-04":["issue47-help-locales.test.mjs"],
 "T1-05":["issue47-agreed-roles-and-owner-registers.test.mjs"],
 "T1-06":["qa-publication-gate.test.mjs"],
 "T1-07":["issue47-agreed-roles-and-owner-registers.test.mjs"],
 "T1-08":["task12-role-robots.test.mjs"],
 "T1-09":["qa-anonymous-roles.test.mjs","task12-real-api-security-negative.test.mjs"],
 "T1-10":["issue47-help-locales.test.mjs","issue47-live-mobile.test.mjs"],
 "T1-11":["issue47-live-mobile.test.mjs","qa-publication-gate.test.mjs"],
 "T2-01":["issue47-carrier-workspace-deadlines.test.mjs","task12-role-robots.test.mjs"],
 "T2-02":["qa-anonymous-roles.test.mjs","task12-role-robots.test.mjs","task12-real-api-security-negative.test.mjs"],
 "T2-03":["qa-anonymous-roles.test.mjs","task12-real-api-security-negative.test.mjs"],
 "T2-04":["issue47-carrier-round-status.test.mjs"],
 "T2-05":["issue47-carrier-xlsx.test.mjs"],
 "T2-06":["issue47-bid-edit-route.test.mjs"],
 "T2-07":["issue47-carrier-xlsx.test.mjs","issue47-insurance-excel-import.test.mjs"],
 "T2-08":["issue47-task2-csv.test.mjs","issue47-legacy-csv-integrity.test.mjs"],
 "T2-09":["issue47-carrier-workspace-deadlines.test.mjs"],
 "T2-10":["issue47-late-ui.test.mjs"],
 "T2-11":["issue47-late-ui.test.mjs"],
 "T2-12":["task2-contrast.test.mjs"],
 "T2-13":["issue47-carrier-round-status.test.mjs"],
 "T2-14":["issue47-owner-optional-reason.test.mjs"],
 "T2-15":["issue47-carrier-workspace-deadlines.test.mjs"],
 "T2-16":["issue28-workflow-separation.test.mjs"],
 "T2-17":["task2-execution-robots.test.mjs"],
 "T2-18":["task2-execution-robots.test.mjs"],
 "T2-19":["issue17-formal-document-ui.test.mjs"],
 "T2-20":["task2-execution-robots.test.mjs"],
 "T2-21":["task2-execution-robots.test.mjs"],
 "T2-22":["task2-execution-robots.test.mjs"],
 "T2-23":["task2-execution-robots.test.mjs","issue17-formal-document-ui.test.mjs"],
 "T2-24":["issue47-carrier-workspace-deadlines.test.mjs"],
 "T2-25":["issue47-agreed-roles-and-owner-registers.test.mjs"],
 "T2-26":["issue47-menu-clarity.test.mjs","issue47-task2-i18n.test.mjs","lw2-dashboard-browser.test.mjs"]
};
if(raw.length!==37)throw Error("Expected exactly 11+26 scenarios, got "+raw.length);
if(Object.keys(mapping).length!==raw.length)throw Error("Every group must have explicit automation mapping or BLOCKED");
for(const item of raw)if(!(item.id in mapping))throw Error("Missing test mapping: "+item.id);
await mkdir("reports",{recursive:true});
const timeout=Number(process.env.QA_TEST_TIMEOUT_MS||"85000");
const allFiles=[...new Set(Object.values(mapping).flat())];
const executed={};
function runTest(filename){
 return new Promise(resolve=>{
  const started=Date.now(), buffers=[], errors=[];
  const proc=spawn(process.execPath,["--test","--test-reporter=spec","tests/"+filename],{env:{...process.env,QA_ROBOT_STAGING:"1",NO_PRODUCTION_WRITE:"1"},stdio:["ignore","pipe","pipe"]});
  let ended=false;
  const timer=setTimeout(()=>{if(!ended)proc.kill("SIGKILL")},timeout);
  proc.stdout.on("data",chunk=>{if(buffers.join("").length<220000)buffers.push(String(chunk))});
  proc.stderr.on("data",chunk=>{if(errors.join("").length<40000)errors.push(String(chunk))});
  proc.on("error",err=>{errors.push(String(err));});
  proc.on("close",(code,signal)=>{ended=true;clearTimeout(timer);resolve({
   exitCode:code,signal,durationMs:Date.now()-started,
   status:code===0?"PASS":signal?"BLOCKED":"FAIL",
   excerpt:(buffers.join("")+"\n"+errors.join("")).slice(-12500)
  })});
 });
}
for(let index=0;index<allFiles.length;index++){
 const name=allFiles[index];
 console.log("[QA ROBOT]",index+1+"/"+allFiles.length,name);
 executed[name]=await runTest(name);
 console.log("[QA ROBOT]",name,executed[name].status,"duration",executed[name].durationMs+"ms");
 if(executed[name].status!=="PASS")console.error("[QA ROBOT DETAILS]",name,executed[name].excerpt.slice(-3000));
}
const stamp=new Date().toISOString();
const runId=process.env.GITHUB_RUN_ID||null;
const report={
 version:1,
 generatedAt:stamp,
 environment:"isolated-ui-and-public-readonly-staging",
 fullAuthorizedE2e:false,
 warning:"Unit/source/browser-with-mocked-API results are NOT full authenticated staging E2E. No production writes. BLOCKED groups are not successful.",
 workflowUrl:runId?"https://github.com/hakaru4i-afk/freight-quotes-web/actions/runs/"+runId:null,
 commit:process.env.GITHUB_SHA||null,
 checks:{},
 scenarios:raw.map(item=>{
   const files=mapping[item.id],runs=files.map(x=>executed[x]);
   const status=!files.length?"BLOCKED":runs.some(x=>x.status==="FAIL")?"FAIL":runs.some(x=>x.status==="BLOCKED")?"BLOCKED":"PARTIAL";
   return {id:item.id,title:item.title,scenarioType:"unit_or_isolated_ui",status,e2eStatus:"PENDING_E2E",files:[...files],note:!files.length?"No safe executable check yet; needs dedicated role-authenticated QA robot.":status==="PARTIAL"?"Available automated checks passed; actual authenticated E2E still missing.":status==="FAIL"?"At least one automated check failed. See per-file logs.":"Test execution blocked."};
 }),
 evidence:allFiles.map(filename=>({file:filename,status:executed[filename].status,exitCode:executed[filename].exitCode,durationMs:executed[filename].durationMs}))
};
for(const category of ["PARTIAL","BLOCKED","FAIL"])report.checks[category]=report.scenarios.filter(x=>x.status===category).length;
report.checks.PASS_E2E=0;
if(report.scenarios.length!==37)throw Error("Incomplete manifest");
await writeFile("reports/task12-robot-matrix.json",JSON.stringify(report,null,2)+"\n");
await writeFile("reports/task12-robot-diagnostics.json",JSON.stringify(executed,null,2)+"\n");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rows=report.scenarios.map(x=>"<tr><td>"+x.id+"</td><td>"+esc(x.title)+"</td><td>"+x.status+"</td><td>"+esc(x.note)+"</td></tr>").join("");
const html='<!DOCTYPE html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Задачи №1 и №2 — автоматические проверки</title><style>body{font-family:system-ui;background:#0c1b29;color:#edf3f8;max-width:1200px;margin:auto;padding:24px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:11px;border-bottom:1px solid #38536b;text-align:left}p{line-height:1.6;color:#b9d0df}</style><h1>QA робот · 37 групп</h1><p>'+esc(report.generatedAt)+" · "+esc(report.commit)+'</p><p><b>Нет полного E2E PASS.</b> PARTIAL — прошли доступные unit/browser проверки, BLOCKED — ещё нет автоматики, FAIL — есть ошибка. Production не затронут.</p><p>PARTIAL '+report.checks.PARTIAL+' · BLOCKED '+report.checks.BLOCKED+' · FAIL '+report.checks.FAIL+'</p><table><thead><tr><th>Группа</th><th>Требование</th><th>Проверка</th><th>Пояснение</th></tr></thead><tbody>'+rows+"</tbody></table></html>";
await writeFile("reports/task12-robot-matrix.html",html);
console.log("RESULT",JSON.stringify(report.checks));
console.log("REPORT reports/task12-robot-matrix.json");
if(report.checks.FAIL>0)process.exitCode=1;
