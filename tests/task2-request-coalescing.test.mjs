import test from'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const source=readFileSync('test/task2-panel.js','utf8');
const code=source.slice(source.indexOf(' let listFlight=null'),source.indexOf(' async function update(action,fields,files){'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const requests=[],state={selected:'A',listView:'active',items:[],notice:''};
 const context={state,document:{querySelector:()=>null},get(query){const r=Promise.withResolvers();requests.push({query,...r});return r.promise;},show(){},alertText(){}};
 runInNewContext(code+'\nglobalThis.load=loadList;',context);return{state,requests,load:context.load};
}
test('twenty overlapping mounts share one list and one detail request',async()=>{
 const f=fixture(),pending=Array.from({length:20},()=>f.load());assert.equal(f.requests.length,1);
 f.requests[0].resolve({role:'owner',items:[{order_code:'A',process_status:'in_progress'}]});await tick();assert.equal(f.requests.length,2);
 f.requests[1].resolve({shipment:{order_code:'A'}});await Promise.all(pending);assert.equal(f.state.detail.shipment.order_code,'A');
});
test('a refresh after mutation supersedes a stale in-flight list',async()=>{
 const f=fixture(),old=f.load(),fresh=f.load({force:true});assert.equal(f.requests.length,2);
 f.requests[1].resolve({role:'owner',items:[{order_code:'B',process_status:'in_progress'}]});await tick();
 f.requests[2].resolve({shipment:{order_code:'B'},revision:2});await fresh;
 f.requests[0].resolve({role:'owner',items:[{order_code:'A',process_status:'in_progress'}]});await old;
 assert.equal(f.state.selected,'B');assert.equal(f.state.detail.revision,2);assert.equal(f.requests.length,3);
});
test('a failed read is released so a user can retry',async()=>{
 const f=fixture(),first=f.load();f.requests[0].reject(Error('Unavailable'));await assert.rejects(first,/Unavailable/);
 const next=f.load();assert.equal(f.requests.length,2);f.requests[1].resolve({role:'owner',items:[]});await next;assert.equal(f.state.detail,null);
});
