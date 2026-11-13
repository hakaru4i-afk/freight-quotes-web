// Protected workflow reuses the real portal/API harness and its session file.
// No credentials, alternative application, or response fixtures are introduced.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const evidence='reports/map50-published';
function run(actors,phase){
 const env={...process.env,QA_MAP50:'true',QA_BROWSER_PUBLISHED:'true',QA_BROWSER_EVIDENCE_DIR:evidence,QA_BROWSER_ACTORS:actors,[phase]:'true'};
 const r=spawnSync(process.execPath,['tests/task12-isolated-browser.e2e.mjs'],{env,stdio:'inherit',timeout:300000});
 if(r.error)throw r.error;if(r.status!==0)throw Error('MAP50 phase failed: '+phase+' '+actors);
}
run('owner','QA_BROWSER_CREATE');run('carrierA,carrierB','QA_BROWSER_BID');run('owner','QA_BROWSER_SELECT');
const winner=JSON.parse(readFileSync(evidence+'/browser-results-owner.json')).roles[0].selection.winnerActor;
if(!['carrierA','carrierB'].includes(winner))throw Error('Invalid selected carrier');
run(winner,'QA_BROWSER_ACCEPT');run('owner','QA_MAP_GEOCODES');run(winner,'QA_MAP_GEOCODES');run('ved','QA_MAP_GEOCODES');
const edits=spawnSync(process.execPath,['tests/map50-real-edits.e2e.mjs'],{env:{...process.env,QA_BROWSER_EVIDENCE_DIR:evidence},stdio:'inherit',timeout:300000});if(edits.error)throw edits.error;if(edits.status!==0)throw Error('MAP50 actual edit/readback failed');
console.log('MAP50_PUBLISHED_CHAIN_PASS');
