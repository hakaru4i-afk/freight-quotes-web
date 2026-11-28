import test from 'node:test';
import assert from 'node:assert/strict';
import {planImpact,parseRaw,checkImpactReceipts,ROLES} from '../scripts/release/qa-impact-plan.mjs';
const a='a'.repeat(40),b='b'.repeat(40),c='c'.repeat(40),d='d'.repeat(40);
const edit=path=>({path,status:'M',oldMode:'100644',newMode:'100644'});
const make=(frontend=[],backend=[],opts={})=>planImpact({base:{frontend:a,backend:c},head:{frontend:frontend.length?b:a,backend:backend.length?d:c},frontend,backend,...opts});
test('VED chat selects transitive dependencies, not all business scenarios',()=>{
 const p=make([edit('lw-ved-shared-chat-20261109.js')]);
 assert.equal(p.mode,'TARGETED');
 for(const name of ['ved-chat','chat-access','notifications','audit','shipment-read','tenant-isolation'])assert.ok(p.components.includes(name));
 for(const role of ['owner','logistic','carrier'])assert.ok(p.roles.includes(role));
 assert.ok(p.required.includes('smoke:all-roles'));
 assert.ok(!p.required.includes('full:37'));
 assert.ok(!p.components.includes('geo'));
});
test('both exact repositories contribute to dependency closure',()=>{
 const p=make([edit('carrier-csv-wps-hotfix.js')],[edit('src/transport-application/geocoding.mjs')]);
 assert.equal(p.mode,'TARGETED');
 for(const name of ['geo','tracking','carrier-import','offer-validation','selection','tenant-isolation'])assert.ok(p.components.includes(name));
});
test('direct Owner, shared app/API, unknown paths, executable and weekly all fail safe to FULL',()=>{
 for(const path of ['owner-team-users-20261117.js','app.js','new.js','.github/workflows/test.yml','style.css'])assert.equal(make([edit(path)]).mode,'FULL');
 assert.equal(make([],[edit('src/transport-application/index.ts')]).mode,'FULL');
 assert.equal(make([{...edit('lw-ved-shared-chat-20261109.js'),newMode:'120000'}]).mode,'FULL');
 assert.equal(make([] ,[],{weekly:true}).mode,'FULL');
 assert.deepEqual(make([],[],{weekly:true}).roles,[...ROLES].sort());
 assert.equal(make([edit('docs/readme.md')]).mode,'QUICK');
});
test('invalid raw data and absent exact diff fail closed',()=>{
 assert.throws(()=>parseRaw(':100644 100644 a b M\0'));
 assert.equal(parseRaw(':100644 100644 a b M\0x.js\0')[0].path,'x.js');
 assert.throws(()=>planImpact({base:{frontend:a,backend:c},head:{frontend:b,backend:c},frontend:[],backend:[]}),/DIFF_PAIR_MISMATCH/);
});
test('receipts reject stale SHA, missing, skipped, wrong runtime, duplicate and modified plan',()=>{
 const p=make([edit('lw-ved-shared-chat-20261109.js')]);
 const receipts=p.required.map(scenario=>({scenario,planId:p.id,runtime:'runtime-a',frontendSha:p.head.frontend,backendSha:p.head.backend,result:'PASS'}));
 assert.equal(checkImpactReceipts(p,receipts,'runtime-a'),'PLAN_RECEIPTS_PASS_NOT_RELEASE_APPROVAL');
 for(const bad of [receipts.slice(1),[...receipts,receipts[0]],[{...receipts[0],result:'SKIPPED'},...receipts.slice(1)],[{...receipts[0],backendSha:c},...receipts.slice(1)]])assert.equal(checkImpactReceipts(p,bad,'runtime-a'),'BLOCKED');
 assert.equal(checkImpactReceipts(p,receipts,'runtime-b'),'BLOCKED');
 assert.equal(checkImpactReceipts({...p,required:[]},receipts,'runtime-a'),'BLOCKED');
});
