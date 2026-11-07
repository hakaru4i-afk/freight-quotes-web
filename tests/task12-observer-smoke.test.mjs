import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const base="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
async function get(path){
  let err;
  for(let i=0;i<6;i++){
    try{
      const res=await fetch(base+path+"?qa_probe="+Date.now(),{redirect:"follow",signal:AbortSignal.timeout(30000),headers:{"Cache-Control":"no-cache"}});
      if(res.status!==200)throw Error("HTTP "+res.status+" "+path);
      return {body:await res.text(),headers:res.headers};
    }catch(e){err=e;if(i<5)await new Promise(r=>setTimeout(r,12000));}
  }
  throw err;
}
test("Task1+Task2: published staging page loads with expected application entrypoint",async()=>{
 const {body}=await get("");
 assert.match(body,/Тестовая среда/);
 assert.match(body,/\.\/app\.js\?v=/);
 assert.match(body,/carrier-acceptance-workflow/);
 assert.match(body,/task2-panel-sidebar-only/);
 assert.doesNotMatch(body,/<script[^>]+src=["']\.\.\/app\.js/);
});
test("Task1+Task2: published source scripts are nonempty",async()=>{
 for(const name of ["app.js","carrier-acceptance-workflow-20261107.js","task2-panel-sidebar-only-20261107.js"]){
  const {body}=await get(name);
  assert.ok(body.length>1000,name+" missing or too short");
 }
});
test("Task1+Task2: public QA observer has exactly 11 Task1 and 26 Task2 pending acceptance groups",async()=>{
 const local=JSON.parse(await readFile("test/qa-observer.json","utf8"));
 assert.equal(local.environment,"staging");
 assert.equal(local.task1.cases.length,11);
 assert.equal(local.task2.cases.length,26);
 const ids=new Set([...local.task1.cases,...local.task2.cases].map(x=>x.id));
 assert.equal(ids.size,37,"duplicate test ids");
 const {body}=await get("qa-observer.json");
 const remote=JSON.parse(body);
 assert.equal(remote.task1.cases.length,11);
 assert.equal(remote.task2.cases.length,26);
 assert.equal(remote.environment,"staging");
 const page=await get("qa-observer.html");
 assert.match(page.body,/Наблюдение за тестированием/);
 assert.match(page.body,/Полная приёмка пока не подтверждена/);
 assert.match(page.body,/id="live-jobs"/);
 assert.match(page.body,/автоматическая проверка бизнес-процессов/i);
 assert.match(page.body,/issues\/29/);

});
test("Task1+Task2: deferred transport document is not silently removed or counted as E2E PASS",async()=>{
 const data=JSON.parse(await readFile("test/qa-observer.json","utf8"));
 assert.equal(data.deferred.find(x=>x.id==="BACKLOG-TRANSPORT")?.status,"DEFERRED");
 assert.equal(data.releaseState,"FULL_ACCEPTANCE_PENDING");
 const evidence=[...data.task1.cases,...data.task2.cases].filter(x=>x.status==="PASS");
 for(const x of evidence)assert.ok(x.evidence.length>0,x.id+" PASS must have evidence");
});

test("Task1+Task2: GitHub Pages serves the latest observer HTML and matrix byte-for-byte",async()=>{
  const names=["qa-observer.html","qa-observer.json"];
  for(const name of names){
    const local=await readFile("test/"+name,"utf8");
    const expected=createHash("sha256").update(local).digest("hex");
    let actual="";
    for(let tries=0;tries<15;tries++){
      const remote=await get(name);
      actual=createHash("sha256").update(remote.body).digest("hex");
      if(actual===expected)break;
      if(tries<14)await new Promise(r=>setTimeout(r,12000));
    }
    assert.equal(actual,expected,"Published "+name+" does not match repository HEAD. Pages is still serving an older version.");
  }
});
