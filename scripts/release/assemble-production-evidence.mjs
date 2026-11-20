import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertProductionReleaseIntegrity} from '../../tests/helpers/production-release-boundary.mjs';
import {inspectProductionGate} from './production-gate.mjs';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hex40=/^[0-9a-f]{40}$/;
const target={frontendSha:process.env.RELEASE_WEB_SHA,backendSha:process.env.RELEASE_API_SHA,businessVersion:'SH-01.30.59 v'};
if(!hex40.test(target.frontendSha||'')||!hex40.test(target.backendSha||''))throw Error('EXACT_COMMIT_SHA_REQUIRED');
const runIds={frontend:process.env.FRONTEND_RUN_ID,backend:process.env.BACKEND_RUN_ID,e2e:process.env.E2E_RUN_ID,recovery:process.env.RECOVERY_RUN_ID};
const runs={};
for(const [name,id] of Object.entries(runIds)){
 if(!/^[1-9][0-9]*$/.test(id||''))throw Error('REQUIRED_RUN_ID_'+name.toUpperCase());
 const run=read('gate-evidence/meta/'+name+'.json');
 if(run.id!==Number(id))throw Error('RUN_ID_MISMATCH_'+name);
 const workflows={
  frontend:'.github/workflows/release-stabilization.yml',
  backend:'.github/workflows/release-stabilization.yml',
  e2e:'.github/workflows/carrier124-main-oidc-smoke.yml',
  recovery:'.github/workflows/issue29-production-backup-gate.yml'
 };
 if(run.path!==workflows[name])throw Error('WRONG_WORKFLOW_'+name);
 runs[name]={...run,repository:name==='backend'||name==='recovery'?'hakaru4i-afk/freight-quotes':'hakaru4i-afk/freight-quotes-web'};
}
const ownerComment=read('gate-evidence/meta/owner.json');
if(ownerComment.id!==Number(process.env.OWNER_COMMENT_ID))throw Error('OWNER_COMMENT_ID_MISMATCH');
const context={
 event:process.env.GITHUB_EVENT_NAME,actor:process.env.GITHUB_ACTOR,ref:process.env.GITHUB_REF,
 repository:process.env.GITHUB_REPOSITORY,
 checkoutSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 mainSha:execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).trim().split(/\s/)[0]
};
if(context.checkoutSha!==target.frontendSha||context.mainSha!==target.frontendSha)throw Error('WEB_SOURCE_DRIFT');
const manifest=read('production-release-manifest.json');
const build=read('build-info.json');
const stage=read('test/build-info.json');
const reports={
 pair:read('gate-evidence/e2e/release-gate-pair.json'),
 regression:read('gate-evidence/frontend/release-gate-regression.json'),
 backend:read('gate-evidence/backend/release-gate-backend.json'),
 e2e:read('gate-evidence/e2e/private-authenticated-e2e.json'),
 backup:read('gate-evidence/recovery/private-production-backup-evidence.json'),
 restore:read('gate-evidence/recovery/private-restore-evidence.json')
};
const packet={context,target,manifest,build,stage,runs,reports,ownerComment};
const decision=inspectProductionGate(packet);
writeFileSync('gate-evidence/decision.json',JSON.stringify({status:decision.status,blockers:decision.blockers,frontendSha:target.frontendSha,backendSha:target.backendSha},null,2)+'\n',{mode:0o600});
if(!decision.allowed)throw Error('RELEASE_BLOCKED:'+decision.blockers.join(','));
assertProductionReleaseIntegrity();
console.log('RELEASE_EVIDENCE_VERIFIED_FOR_EXACT_PAIR; OWNER_APPROVAL_VERIFIED; PRODUCTION_NOT_DEPLOYED');
