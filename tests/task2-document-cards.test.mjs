import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Exercise the actual document renderer for each role without opening an API session.
const source=readFileSync("test/task2-panel-sidebar-only-20261107.js","utf8");
const begin=source.indexOf(" function renderTab("),end=source.indexOf(" function taskCard(",begin);
assert.ok(begin>=0&&end>begin,"document renderer exists");
const block=source.slice(begin,end);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function makeRenderer(role){
 const state={tab:"documents",role,login:role==="carrier"?"carrier@qa.test":"ved@qa.test",logistics:[]};
 const evaluator=new Function("state","esc","fmt","docTypes","taskCard","departurePlans",
  'const readonly=()=>"";const form=()=>"";const field=()=>"";'+block+';return renderTab;');
 return evaluator(state,esc,s=>s,["Инвойс","CMR","Упаковочный лист"],
   t=>'<article data-task="'+esc(t.task_type)+'"></article>',()=>[]);
}
const detail={
 shipment:{order_code:"QA-DOC-CARDS-001",carrier_login:"carrier@qa.test"},
 state:{status:"in_progress"},
 docs:[
  {id:"owner-1",name:"original.xlsx",category:"owner_file"},
  {id:"ved-1",name:"invoice.pdf",category:"task2",uploaded_role:"logistic"},
  {id:"carrier-1",name:"cmr.pdf",category:"task2",actor:"carrier@qa.test"}
 ],
 tasks:[
  {id:"req-ved",task_type:"missing_documents",status:"open",description:"Invoice"},
  {id:"req-carrier",task_type:"ved_request_carrier",status:"open",description:"CMR"}
 ]
};
test("all files grouped into three compact source cards",()=>{
 const html=makeRenderer("owner")(detail,false,true);
 assert.equal((html.match(/class="t2-docs-group" /g)||[]).length,3);
 for(const name of ["original.xlsx","invoice.pdf","cmr.pdf"])assert.ok(html.includes(name));
 assert.doesNotMatch(html,/Загрузить документы в общий реестр|Запросы документов и задачи ВЭД/);
 for(const key of ["owner","ved","carrier"])assert.ok(html.includes('data-doc-source="'+key+'"'));
});
test("VED requests carrier file inside carrier card, uploads within VED card",()=>{
 const html=makeRenderer("ved")(detail,false,true);
 const ved=html.split('data-doc-source="ved"')[1].split('data-doc-source="carrier"')[0];
 const carrier=html.split('data-doc-source="carrier"')[1];
 assert.match(ved,/Загрузить документ/);
 assert.match(carrier,/Запросить документ у перевозчика/);
 assert.match(carrier,/data-t2-form="request_carrier_docs"/);
 assert.doesNotMatch(ved,/request_carrier_docs/);
 assert.match(html,/data-task="ved_request_carrier"/);
});
test("carrier requests VED file and uploads a response into carrier card",()=>{
 const html=makeRenderer("carrier")(detail,true,false);
 const ved=html.split('data-doc-source="ved"')[1].split('data-doc-source="carrier"')[0];
 const carrier=html.split('data-doc-source="carrier"')[1];
 assert.match(ved,/Запросить документ у ВЭД/);
 assert.match(carrier,/Загрузить документ/);
 assert.match(carrier,/value="req-carrier"/);
 assert.doesNotMatch(html,/data-t2-form="request_carrier_docs"/);
});
test("completed shipment is read only; Owner cannot create carrier requests",()=>{
 for(const role of ["owner","ved","carrier"]){
  const html=makeRenderer(role)({...detail,state:{status:"completed"}},role==="carrier",role!=="carrier");
  assert.doesNotMatch(html,/data-t2-form="upload"/);
  assert.doesNotMatch(html,/data-t2-form="request_carrier_docs"/);
 }
 assert.doesNotMatch(makeRenderer("owner")(detail,false,true),/data-t2-form="request_carrier_docs"/);
 assert.equal((makeRenderer("owner")(detail,false,true).match(/data-t2-form="upload"/g)||[]).length,1);
});
