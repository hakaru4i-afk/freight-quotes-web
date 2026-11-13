// Full real workflow; callable from protected CI or the existing local QA session.
import{spawnSync}from'node:child_process';import{readFileSync}from'node:fs';
const evidence=process.env.QA_NOV14_EVIDENCE_DIR||'reports/nov14-published';
function run(actors,flag,value='true'){
 const env={...process.env,QA_MAP50:'true',QA_NOV14_RAIL:'true',QA_BROWSER_EVIDENCE_DIR:evidence,QA_BROWSER_ACTORS:actors};
 for(const key of ['QA_BROWSER_CREATE','QA_BROWSER_BID','QA_BROWSER_SELECT','QA_BROWSER_ACCEPT','QA_MAP_GEOCODES','QA_NOV14_PHASE','QA_BROWSER_VED_WORK','QA_BROWSER_LOGISTIC_DOCUMENT','QA_BROWSER_VED_VERIFY'])delete env[key];
 env[flag]=value;
 const r=spawnSync(process.execPath,['tests/task12-isolated-browser.e2e.mjs'],{env,stdio:'inherit',timeout:360000});if(r.error)throw r.error;if(r.status!==0)throw Error('NOV14 phase failed: '+flag+' '+value+' '+actors);
}
run('owner','QA_BROWSER_CREATE');run('carrierA,carrierB','QA_BROWSER_BID');run('owner','QA_BROWSER_SELECT');
const winner=JSON.parse(readFileSync(evidence+'/browser-results-owner.json')).roles[0].selection.winnerActor;
if(!['carrierA','carrierB'].includes(winner))throw Error('Invalid winner');
run(winner,'QA_BROWSER_ACCEPT');run('owner','QA_MAP_GEOCODES');run(winner,'QA_NOV14_PHASE','carrier');
run('ved','QA_BROWSER_VED_WORK');run('logistic','QA_BROWSER_LOGISTIC_DOCUMENT');run('ved','QA_BROWSER_VED_VERIFY');
run('owner','QA_NOV14_PHASE','start-review');run('ved','QA_NOV14_PHASE','remarks');run(winner,'QA_NOV14_PHASE','correct-documents');run('ved','QA_NOV14_PHASE','approve');run(winner,'QA_NOV14_PHASE','stages');run('owner','QA_NOV14_PHASE','finish');
console.log('NOV14_REAL_FULL_CHAIN_PASS');
