// Regression tests use the exact counter validation and refresh functions from the
// published staging bundle, not a duplicate helper or mocked replacement component.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../test/app.js',import.meta.url),'utf8');
const stages=['new','viewed','preparing','review','selected','execution'];
const filters=['all','requires_response','declined','lost','completed','archive'];
const descriptors=arr=>arr.map(x=>[x,x]);
const begin=src.indexOf('function issue124ValidateDashboard(');
const end=src.indexOf('function issue124CarrierCards(',begin);
assert.ok(begin>=0&&end>begin,'Production candidate includes the counter/list verification function');
const validator=new Function('issue124Stages','issue124Filters',src.slice(begin,end)+';return issue124ValidateDashboard;')(descriptors(stages),descriptors(filters));
function snapshot(stagesIn=stages){
 const items=stagesIn.map((stage,i)=>({id:'note-'+i,stage,filters:['all',...['new','viewed','preparing'].includes(stage)?['requires_response']:[],...['declined','lost','completed'].includes(stage)?[stage,'archive']:[],...(stage==='archive'?['archive']:[])]}));
 const counts=Object.fromEntries([...stages,...filters].map(key=>[key,items.filter(x=>x.stage===key||x.filters.includes(key)).length]));
 return {version:1,scope:'assigned_requests',items,counts};
}
test('all 12 server counters equal the actual carrier lists',()=>{
 const data=snapshot([...stages,'declined','lost','completed','archive']);
 assert.equal(validator(data),data);
 assert.equal(data.counts.archive,4);assert.equal(data.counts.requires_response,3);
});
test('real zero is visible for every category and is not treated as missing',()=>{
 const data=snapshot([]);
 assert.deepEqual(validator(data).counts,Object.fromEntries([...stages,...filters].map(key=>[key,0])));
});
test('reject duplicated notification ids, invalid stages and synthetic counts',()=>{
 const dup=snapshot(['new','viewed']);dup.items[1].id=dup.items[0].id;
 assert.throws(()=>validator(dup),/Неверный список/);
 const unknown=snapshot(['new']);unknown.items[0].stage='undeclared';
 assert.throws(()=>validator(unknown),/Неверный список/);
 const mismatch=snapshot(['new']);mismatch.counts.new=2;
 assert.throws(()=>validator(mismatch),/Счётчики не совпадают/);
});
test('reject incomplete or invalid server counter schemas',()=>{
 for(const candidate of [null,{}, {version:1,items:[],counts:null}]){
  assert.throws(()=>validator(candidate),/Неверный ответ сервера/);
 }
 const incomplete=snapshot([]);delete incomplete.counts.archive;
 assert.throws(()=>validator(incomplete),/Счётчики не совпадают/);
 const negative=snapshot([]);negative.counts.new=-1;
 assert.throws(()=>validator(negative),/Счётчики не совпадают/);
});
function extractRefresh(){
 const start=src.indexOf('async function de(){',src.indexOf('function Z0(){let[dashboard,setDashboard]'));
 const end=src.indexOf('}(0,Nt.useEffect)',start);
 assert.ok(start>0&&end>start,'Actual refresh body detected in Carrier cabinet');
 return src.slice(start,end+1);
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {resolve,promise}}
function harness(){
 const calls=[],updates=[],error=[],busy=[],serial={current:0};
 const make=()=>{const d=deferred();calls.push(d);return d.promise};
 const wrap=new Function('deps',`const {fetch,issue124ValidateDashboard,issue124RequestSerial,w,setDashboard,A,R,M,y,E,T}=deps; ${extractRefresh()};return de;`);
 const run=wrap({fetch:make,issue124ValidateDashboard:validator,issue124RequestSerial:serial,w:x=>updates.push(['policy',x]),setDashboard:x=>updates.push(['dashboard',x.counts.new]),A:x=>updates.push(['bids',x]),R:x=>updates.push(['notes',x]),M:x=>updates.push(['token',x]),y:x=>updates.push(['time',x]),E:x=>error.push(x),T:x=>busy.push(x)});
 return {run,calls,updates,error,busy};
}
const response=(data,status=200)=>({ok:status===200,json:async()=>data});
test('slow older success cannot replace fresh auto/manual counter readback',async()=>{
 const h=harness();
 const slow=h.run(),fresh=h.run();
 h.calls[1].resolve(response({dashboard:snapshot(['new','new']),bids:[],notifications:[],policy:{score:99}}));
 await fresh;
 h.calls[0].resolve(response({dashboard:snapshot(['new']),bids:[],notifications:[],policy:{score:88}}));
 await slow;
 assert.deepEqual(h.updates.filter(x=>x[0]==='dashboard'),[['dashboard',2]]);
 assert.deepEqual(h.updates.filter(x=>x[0]==='policy'),[['policy',{score:99}]]);
 assert.deepEqual(h.error,['']);
});
test('old stale error cannot overwrite a fresh successful request',async()=>{
 const h=harness();
 const old=h.run(),latest=h.run();
 h.calls[1].resolve(response({dashboard:snapshot(['viewed']),bids:[],notifications:[]}));
 await latest;
 h.calls[0].resolve(response({error:'Old outage'},503));
 await old;
 assert.deepEqual(h.error,['']);
 assert.equal(h.updates.filter(x=>x[0]==='dashboard').length,1);
});
test('corrupted new snapshot does not silently show a fake zero',async()=>{
 const h=harness();const current=h.run(),bad=snapshot(['new']);bad.counts.new=0;
 h.calls[0].resolve(response({dashboard:bad,bids:[],notifications:[]}));
 await current;
 assert.equal(h.updates.filter(x=>x[0]==='dashboard').length,0);
 assert.match(h.error.at(-1),/Счётчики не совпадают/);
});
test('only latest fetch clears initial loading after overlapping reads',async()=>{
 const h=harness();const older=h.run(),newer=h.run();
 h.calls[0].resolve(response({dashboard:snapshot(['viewed']),bids:[],notifications:[]}));
 await older;
 assert.equal(h.busy.length,0);
 h.calls[1].resolve(response({dashboard:snapshot([]),bids:[],notifications:[]}));
 await newer;
 assert.deepEqual(h.busy,[false]);
});
