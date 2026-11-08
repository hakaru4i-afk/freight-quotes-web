import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../test/task2-panel-sidebar-only-20261107.js",import.meta.url),"utf8");
const start=source.indexOf("async function onSubmit(ev){");
const end=source.indexOf("async function onClick(ev){",start);
assert.ok(start>0 && end>start,"submit handler missing");
const handler=source.slice(start,end);

async function run({types=["Инвойс"],description="",kind="transport_documents",busy=false,result={ok:true,task:{id:"12345678-0000-0000-0000-000000000000"}}}={}){
  const calls=[],notices=[],button={disabled:false,textContent:"Направить запрос ВЭД"};
  let focused=false, prevented=false;
  const select={selectedOptions:types.map(value=>({value})),focus(){focused=true;}};
  const fields={kind,description};
  const form={dataset:{t2Form:"request_docs"},querySelector(selector){
    if(selector.includes('select[name="types"]'))return select;
    if(selector.includes('button[type="submit"]'))return button;
    return null;
  }};
  const context={
    state:{busy,selected:"QA-REQUEST-001"},
    FormData:class {constructor(){this.payload=fields;} entries(){return Object.entries(this.payload)[Symbol.iterator]();}},
    requestFeedback(message,error=false){notices.push({message,error});},
    update:async(action,payload)=>{calls.push({action,payload});return result;},
    document:{querySelector(){return button;}},
    alertText(){},
    minskISO(x){return x;},
    window:{}
  };
  vm.runInNewContext(handler,context,{filename:"task2-submit-handler"});
  await context.onSubmit({target:{closest(){return form;}},preventDefault(){prevented=true;}});
  return {calls,notices,button,focused,prevented};
}

test("selected document sends one request without mandatory description and acknowledges server task",async()=>{
  const a=await run();
  assert.ok(a.prevented);
  assert.equal(a.calls.length,1);
  assert.equal(a.calls[0].action,"request_docs");
  assert.equal(a.calls[0].payload.kind,"transport_documents");
  assert.equal(a.calls[0].payload.types[0],"Инвойс");
  assert.match(a.calls[0].payload.description,/Инвойс/);
  assert.match(a.notices.at(-1).message,/Запрос отправлен ВЭД/);
  assert.match(a.notices.at(-1).message,/12345678/);
  assert.equal(a.button.disabled,false);
});
test("missing document and description fails locally with visible feedback",async()=>{
  const a=await run({types:[]});
  assert.equal(a.calls.length,0);
  assert.ok(a.focused);
  assert.match(a.notices.at(-1).message,/Выберите документ/);
  assert.equal(a.notices.at(-1).error,true);
});
test("server rejection is displayed beside the request button, not reported as success",async()=>{
  const a=await run({result:{ok:false,error:"ВЭД недоступен"}});
  assert.equal(a.calls.length,1);
  assert.match(a.notices.at(-1).message,/не отправлен.*ВЭД недоступен/);
  assert.equal(a.notices.at(-1).error,true);
});
test("explicit description without selected document is allowed",async()=>{
  const a=await run({types:[],description:"Нужна копия подписанного оригинала"});
  assert.equal(a.calls.length,1);
  assert.equal(a.calls[0].payload.description,"Нужна копия подписанного оригинала");
  assert.equal(a.calls[0].payload.types.length,0);
});
test("request is not submitted again while form is busy",async()=>{
  const a=await run({busy:true});
  assert.equal(a.calls.length,0);
  assert.match(a.notices.at(-1).message,/уже отправляется/);
});
