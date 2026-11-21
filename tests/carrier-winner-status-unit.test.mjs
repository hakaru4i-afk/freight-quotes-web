import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('test/app.js','utf8');
const start=app.indexOf('function issue47Stage(n,b)'),end=app.indexOf('function S0(',start);
assert.ok(start>=0&&end>start,'Carrier helpers must exist');
const f=vm.runInNewContext(app.slice(start,end)+';({stage:issue47Stage,label:issue47StageLabel})',{Date,Number,String});
const note=(changes={})=>({order_code:'Q1',round_id:'r1',is_current:1,workflow_status:'new',...changes});
const bid=[{order_code:'Q1',round_id:'r1',decision:'accepted',amount:4500}];
test('terminal losing decision overrides stale active dashboard and bid admission',()=>{
 assert.equal(f.stage(note({round_result:'lost',dashboard_stage:'review'}),bid),'archive');
 assert.equal(f.label(note({round_result:'lost',dashboard_stage:'review'}),bid),'Не выбран · архив');
 assert.equal(f.stage(note({round_result:'declined',dashboard_stage:'preparing'}),bid),'archive');
});
test('actual owner winner overrides interim dashboard, with explicit winner label',()=>{
 assert.equal(f.stage(note({selected_offer:{bid_id:'winner'},dashboard_stage:'review'}),bid),'selected');
 assert.equal(f.label(note({selected_offer:{bid_id:'winner'},dashboard_stage:'review'}),bid),'Победитель');
});
test('completed and old rounds cannot reappear as active for this carrier',()=>{
 assert.equal(f.stage(note({completion_state:'completed',dashboard_stage:'review'}),bid),'completed');
 assert.equal(f.stage(note({is_current:0,dashboard_stage:'review'}),bid),'archive');
});
