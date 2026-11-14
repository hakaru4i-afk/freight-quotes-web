import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const s=readFileSync('test/task2-panel.js','utf8');
const submit=s.slice(s.indexOf(' async function onSubmit(ev){'),s.indexOf('   if(kind==="weekly-point"){'))+'\n }';
function fixture(decision,{checked=false,remarks='Missing signed invoice; please attach it'}={}){
 const calls=[],alerts=[],f={dataset:{t2Form:'pto-review'},elements:{packageComplete:{checked}}};
 const context={FormData:class{entries(){return [['taskId','review'],['remarks',remarks]];}},Object,JSON,crypto:{randomUUID:()=> 'fixed-request'},update:async(...args)=>calls.push(args),alertText:x=>alerts.push(x)};
 runInNewContext(submit+'\nglobalThis.submit=onSubmit',context);
 return{calls,alerts,f,submit:()=>context.submit({target:{closest:()=>f},preventDefault(){},submitter:{value:decision}})};
}
test('VED approval requires explicit package confirmation in the actual submit handler',async()=>{const f=fixture('approve');await f.submit();assert.equal(f.calls.length,0);assert.equal(f.alerts.length,1);});
test('VED remarks submit task identity, real text and stable retry identity',async()=>{const f=fixture('remarks');await f.submit();await f.submit();assert.equal(f.calls.length,2);assert.equal(f.calls[0][0],'complete_task');assert.equal(f.calls[0][1].reviewDecision,'remarks');assert.equal(f.calls[0][1].taskId,'review');assert.equal(f.calls[0][1].requestId,f.calls[1][1].requestId);});
test('VED approval sends explicit decision and boolean package flag',async()=>{const f=fixture('approve',{checked:true});await f.submit();assert.equal(f.calls[0][1].reviewDecision,'approve');assert.equal(f.calls[0][1].packageComplete,true);});
test('VED short remarks are rejected before any request',async()=>{const f=fixture('remarks',{remarks:'short'});await f.submit();assert.equal(f.calls.length,0);assert.equal(f.alerts.length,1);});
