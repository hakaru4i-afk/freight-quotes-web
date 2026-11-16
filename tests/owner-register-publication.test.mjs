import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const source=readFileSync('test/owner-registers-20261111.js','utf8'),start=source.indexOf('const recordState='),end=source.indexOf('const finished=',start),context={};
assert.ok(start>=0&&end>start);runInNewContext(source.slice(start,end)+'\nglobalThis.stateFor=recordState;',context);
test('verified publication stays visible when an older work item is completed or still open',()=>{
 for(const status of ['completed','in_progress','release'])assert.equal(context.stateFor({status:'production_verified'},{status}),'production_verified');
});
test('completed development work still awaits release verification',()=>{
 assert.equal(context.stateFor({status:'fixed_review'},{status:'completed'}),'fixed_review');assert.equal(context.stateFor({status:'fixed_review'},{status:'in_progress'}),'in_progress');assert.equal(context.stateFor({status:'deferred'},null),'deferred');
});
