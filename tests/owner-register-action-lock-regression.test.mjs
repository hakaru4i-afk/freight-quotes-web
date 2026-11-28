import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const paths=['owner-register-task-actions-20261121.js','test/owner-register-task-actions-20261121.js'];
const make=tag=>({tag,children:[],dataset:{},style:{},classList:{toggle(){}},disabled:false,hidden:false,setAttribute(){},append(...children){this.children.push(...children)},focus(){}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const file of paths)test('Owner intake preserves disabled state and rejects locked actions: '+file,async()=>{
 const window={},document={documentElement:{lang:'ru'},createElement:make};
 runInNewContext(readFileSync(file,'utf8'),{window,document});
 const find=(e,cls)=>e.className===cls?e:e.children.map(c=>find(c,cls)).find(Boolean);
 let calls=0;
 const build=(id,execution={},state='new',handler=async()=>{calls++;})=>window.OWRegisterTaskActions.render({register:'remarks',row:{id},execution,state,onAction:handler});
 const controls=e=>['ow-task-btn ow-task-btn-start','ow-task-btn ow-task-btn-postpone','ow-task-btn ow-task-btn-reject','ow-task-reason-apply'].map(cls=>find(e,cls));
 for(const [id,execution,state] of [['busy',{decision:'in_progress'},'new'],['archive',{},'published']]){
  const buttons=controls(build(id,execution,state));
  assert.ok(buttons.every(b=>b.disabled));
  buttons[0].onclick(); await flush();
  assert.equal(calls,0);
  assert.ok(buttons.every(b=>b.disabled));
 }
 let release; const active=controls(build('open',{},'new',()=>{calls++;return new Promise(resolve=>release=resolve)}));
 active[0].onclick(); assert.ok(active.every(b=>b.disabled)); active[0].onclick(); assert.equal(calls,1);
 release(); await flush(); assert.ok(active.every(b=>!b.disabled));
 const failed=controls(build('failed',{},'new',async()=>{throw Error('test failure')}));
 failed[0].onclick(); await flush(); assert.ok(failed.every(b=>!b.disabled));
});
test('Owner intake source parity',()=>assert.equal(readFileSync(paths[0],'utf8'),readFileSync(paths[1],'utf8')));
