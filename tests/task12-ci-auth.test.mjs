import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const prefixes={OWNER:'owner',CARRIER_A:'carriera',CARRIER_B:'carrierb',VED:'ved',LOGISTIC:'logistic',SUPPLIER:'supplier',DESIGNER:'designer',CONTENT:'content',PURCHASING:'purchasing',CERTIFICATION:'certification'};
function run(configured){const env={...process.env,NODE_USE_ENV_PROXY:'1',HTTPS_PROXY:'http://127.0.0.1:1',HTTP_PROXY:'http://127.0.0.1:1'};for(const[p,id]of Object.entries(prefixes)){delete env['QA_'+p+'_LOGIN'];delete env['QA_'+p+'_PASSWORD'];if(configured){env['QA_'+p+'_LOGIN']='rc20261110-'+id;env['QA_'+p+'_PASSWORD']='do-not-log-this-password';}}if(configured)env.QA_OWNER_LOGIN='outside-isolated-test-scope';return spawnSync(process.execPath,['tests/task12-ci-auth.mjs'],{env,encoding:'utf8',timeout:5000});}
test('missing protected bindings fail closed without contacting API',()=>{const r=run(false);assert.equal(r.status,1);assert.match(r.stdout,/MISSING_PROTECTED_QA_BINDINGS/);assert.doesNotMatch(r.stdout,/QA_REAL_AUTH_PASS/);});
test('credentials outside the fixed QA scope are refused before any request',()=>{const r=run(true);assert.equal(r.status,1);assert.match(r.stdout,/QA_LOGIN_SCOPE_MISMATCH:owner/);assert.doesNotMatch(r.stdout,/do-not-log-this-password|outside-isolated-test-scope/);});

test('published role E2E is manual, main-only, protected and scopes credentials to authentication',async()=>{
 const {readFileSync}=await import('node:fs');const y=readFileSync('.github/workflows/isolated-qa-published-browser.yml','utf8');
 assert.match(y,/workflow_dispatch:/);assert.doesNotMatch(y,/pull_request_target:|\n  push:|\n  pull_request:/);assert.match(y,/github.ref == 'refs\/heads\/main'/);assert.match(y,/environment: isolated-qa/);assert.match(y,/contents: read/);assert.doesNotMatch(y,/contents: write|secrets: inherit/);
 const auth=y.slice(y.indexOf('      - name: Verify real QA sessions'),y.indexOf('      - run: npm install'));
 assert.equal((auth.match(/secrets\.QA_/g)||[]).length,20);assert.equal((y.match(/secrets\.QA_/g)||[]).length,20);
 assert.match(y,/npm install --no-save --ignore-scripts playwright@1\.56\.1/);assert.match(y,/if: always\(\)\n        run: node tests\/task12-ci-auth.mjs --logout/);
});
