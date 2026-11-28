import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {explainAuditEvent} from "../owner-audit-explanations-20261117.mjs";

test("403: old owner-preview request is explained as a known UI request, not an intrusion",()=>{
 const event=explainAuditEvent({kind:"denied",path:"/api/test-cabinets",action:"get",role:"carrier",status:403});
 assert.match(event.title,/Автоматический запрос/);
 assert.match(event.what,/интерфейс запросил/);
 assert.match(event.why,/только владельцу/);
 assert.match(event.outcome,/Сервер отклонил запрос/);
 assert.match(event.origin,/не доказывает попытку сотрудника/);
});
test("unknown 403 never attributes intent or invents a specific access policy",()=>{
 const event=explainAuditEvent({kind:"denied",path:"/api/shipments",action:"post",status:403});
 assert.match(event.title,/Доступ/);
 assert.match(event.what,/отправка запроса/);
 assert.match(event.why,/Точная причина/);
 assert.match(event.origin,/нельзя установить/);
});
test("logs explain other failure categories without confusing them with successful actions",()=>{
 for(const [status,needle] of [[400,/проверку/],[404,/найти/],[409,/Конфликт/],[429,/Слишком много/],[500,/Сбой сервера/]]){
  const event=explainAuditEvent({kind:status===500?"server_error":"validation",path:"/api/quote",action:"submit",status});
  assert.match(event.title,needle);
 }
});
test("page view is not falsely called a business action",()=>{
 const event=explainAuditEvent({kind:"page",path:"site-monitor",action:"view",status:0});
 assert.match(event.what,/открытие раздела/);
 assert.match(event.outcome,/не подтверждает выполнение/);
});
test("existing audit is preserved and security gateway untouched",()=>{
 const ui=readFileSync("owner-audit-explanations-20261117.mjs","utf8");
 const stage=readFileSync("test/owner-audit-explanations-20261117.mjs","utf8");
 assert.equal(stage,ui);
 assert.ok(!/fetch\s*\(|\.delete\s*\(|\.remove\s*\(/.test(ui));
 assert.match(ui,/details\.append\(technical\)/);
 assert.match(ui,/ownerAuditExplained/);
});

test('new server evidence preserves exact causes, rollback and actual preview role',()=>{
 const event=explainAuditEvent({source:'server',kind:'validation',path:'/api/owner-register-execution',action:'accept_published',status:409,reasonCode:'STATE_CONFLICT',serverCode:'PUBLICATION_NOT_VERIFIED',phase:'transaction_rollback',role:'owner',effectiveRole:'logistic'});
 assert.match(event.why,/не подтвердил доказательство публикации/);
 assert.match(event.outcome,/откатилась/);
 assert.match(event.origin,/Владелец.*ВЭД/);
 const pending=explainAuditEvent({source:'server',path:'/api/requests',status:202,phase:'post_commit_pending'});
 assert.match(pending.outcome,/ещё выполняется/);
 assert.doesNotMatch(pending.outcome,/полностью завершена/);
 const rejected=explainAuditEvent({source:'server',path:'/api/test-cabinets',status:403,reasonCode:'ACCESS_DENIED'});
 assert.doesNotMatch(rejected.title,/Автоматический запрос/);
 const unknown=explainAuditEvent({source:'server',path:'/api/quote',status:409,serverCode:'UNTRUSTED_SECRET'});
 assert.doesNotMatch(JSON.stringify(unknown),/UNTRUSTED_SECRET/);
});
test('both bundles pass the actual route and observed details to the existing Owner table',()=>{
 for(const name of ['app.js','test/app.js']){
  const app=readFileSync(name,'utf8');
  for(const key of ['path','kind','source','role','reason-code','server-code','phase','effective-role','target'])assert.ok(app.includes('data-site-audit-'+key),name+': '+key);
  assert.ok(app.includes('S.status===202?"Ожидает завершения"'));
 }
});


test("all specifically required HTTP codes are explained without inferring intent",()=>{
 for(const [status,title] of [[424,/зависимая/],[431,/заголовки/],[501,/не реализована/],[507,/Недостаточно/],[508,/цикл/]]){
 const event=explainAuditEvent({source:"server",path:"/api/task2",status});
 assert.match(event.title,title);
 assert.match(event.origin,/нельзя установить/);
 }
});
test("root and staging use same server filter controls and preserve pagination query",()=>{
 for(const path of ["app.js","test/app.js"]){
 const app=readFileSync(path,"utf8");
 assert.match(app,/function issue1AuditFilters\(state,setState\)/);
 for(const key of ["role","cabinet","http","target","source","outcome","path"])assert.ok(app.includes('["'+key+'",'),key);
 assert.match(app,/actor:_,kind:b,\.\.\.advanced\}\);N.current=W.toString\(\)/);
 assert.ok(app.includes("...issue1AuditFilters(advanced,setAdvanced)"));
 assert.ok(app.includes('N.current+(S?"&cursor="'));
 }
});

test('Native audit events are distinguished from HTTP responses and browser reports',()=>{
 const e={source:'server',phase:'domain_commit',serverCode:'DOMAIN_EVENT_CONFIRMED',status:0,kind:'action',path:'/api/auth',action:'native_auth_failed_three_times'};
 const r=explainAuditEvent(e);assert.match(r.title,/Три неудачные/);assert.match(r.outcome,/HTTP-код не присваивается/);
 assert.doesNotMatch(explainAuditEvent({...e,source:'client'}).title,/Три неудачные/);
 assert.doesNotMatch(explainAuditEvent({...e,status:403}).title,/Три неудачные/);
 assert.match(explainAuditEvent({...e,action:'native_execution_application_submit',path:'/api/shipment-execution'}).title,/отправлена/);
});

test('Native SL shows actual subject and does not expose unvalidated values',()=>{
 const e={source:'server',phase:'domain_commit',serverCode:'DOMAIN_EVENT_CONFIRMED',status:0,kind:'action',path:'/api/service-level',action:'native_sl_document_error',subjectLogin:'carrier1'};
 const r=explainAuditEvent(e);assert.match(r.title,/Ошибка документов/);assert.match(r.what,/carrier1/);
 assert.doesNotMatch(explainAuditEvent({...e,subjectLogin:'private token'}).what,/private token/);
 for(const path of ['app.js','test/app.js'])assert.match(readFileSync(path,'utf8'),/data-site-audit-subject-login/);
});
