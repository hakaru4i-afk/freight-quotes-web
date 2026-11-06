import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectSummary,inspectChangedFiles,verify} from '../scripts/qa-publication-gate.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('../test/qa-public-status.json',import.meta.url)));
test('safe public QA summary has bounded facts and still reports incomplete Task2',()=>{
 assert.deepEqual(inspectSummary(baseline),[]);
 assert.equal(baseline.task2.ownerAccepted,0);
 assert.equal(baseline.production,'NOT_MODIFIED');
 assert.equal(baseline.roleIsolation.status,'PARTIAL');
});
test('raw QA exports, screenshots and backups are blocked',()=>{
 for(const p of ['test/qa-artifacts/output.json','test/qa-run/screenshot.png','docs/evidence/export.xlsx','test/dump.sql','test/qa-raw/db.zip','test/.env'])
   assert.ok(inspectChangedFiles([p]).length>0,p);
});
test('public summary rejects credentials, emails and personal fields',()=>{
 for(const x of [{password:'pass'},{session:'abc'},{anything:'name@example.org'},{raw:{a:1}},{secret:'sb_'+'secret_abcdefghijklmnop1234'},{database:'postgresql://u:p@db.invalid/a'}])
   assert.ok(inspectSummary({...baseline,...x}).length>0);
});
test('false PASS claims cannot override release gate',()=>{
 assert.ok(inspectSummary({...baseline,task2:{totalGroups:26,ownerAccepted:27}}).length>0);
 assert.ok(inspectSummary({...baseline,release:{...baseline.release,status:'PUBLISHED_PRODUCTION'}}).length>0);
});
test('static manifest passes local gate',()=>assert.equal(verify(),0));
