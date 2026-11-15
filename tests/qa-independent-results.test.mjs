import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{spawnSync}from'node:child_process';
const workflow=readFileSync('.github/workflows/isolated-qa-oidc-browser.yml','utf8'),blocks=workflow.split(/^      - /m),checks=blocks.filter(b=>b.includes('        continue-on-error: true')).map(b=>b.match(/^        id: (\w+)$/m)?.[1]);
const gate=blocks.find(b=>b.startsWith('name: Require every independent acceptance result'));const source=gate?.match(/<<'JS'\n([\s\S]*?)\n          JS/)?.[1];
const run=values=>spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',env:Object.fromEntries(Object.entries({...process.env,...values}).filter(([k])=>!k.startsWith('QA_RESULT_')||Object.hasOwn(values,k)))});
test('every continued acceptance step is included in the final mandatory gate',()=>{assert.equal(checks.length,7);assert.equal(new Set(checks).size,7);assert.ok(source);assert.match(gate,/if: always\(\)/);for(const id of checks)assert.ok(gate.includes('QA_RESULT_'+id.toUpperCase()+': ${{ steps.'+id+'.outcome }}'));});
const good=Object.fromEntries(checks.map(id=>['QA_RESULT_'+id.toUpperCase(),'success']));
test('independent acceptance succeeds only when all declared outcomes succeeded',()=>assert.equal(run(good).status,0));
for(const state of ['failure','skipped','cancelled',''])test('independent acceptance rejects '+(state||'empty outcome'),()=>{const r=run({...good,QA_RESULT_OWNER_ALIGNMENT:state});assert.equal(r.status,1);assert.match(r.stdout,/QA_ACCEPTANCE_BLOCKED/);});
