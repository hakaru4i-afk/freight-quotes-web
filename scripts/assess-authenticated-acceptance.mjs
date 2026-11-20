// Compile actual immutable browser/API receipts into the existing 37-group gate.
// Missing, failed, stale or mocked source evidence never becomes PASS.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';

const [artifactDir,runFile,manifestFile,outArg]=process.argv.slice(2);
if(!artifactDir||!runFile||!manifestFile||!outArg)throw Error('Usage: extracted-protected-artifact-dir github-run.json candidate-manifest.json output-dir');
const json=file=>JSON.parse(readFileSync(file));
const artifact=realpathSync(artifactDir),run=json(runFile),manifest=json(manifestFile),out=resolve(outArg);
const runId=String(run.databaseId),gitSha=/^[a-f0-9]{40}$/,hash=/^[a-f0-9]{64}$/;
assert.equal(run.status,'completed');
assert.equal(run.conclusion,'success','Acceptance requires a successful protected workflow');
assert.equal(run.headBranch,'main');
assert.equal(run.event,'workflow_dispatch');
assert.equal(run.workflowName,'Carrier124 live OIDC acceptance on isolated SH59 (11 roles)');
assert.match(run.headSha,gitSha);
assert.match(runId,/^[1-9][0-9]*$/);
assert.equal(run.url,'https://github.com/hakaru4i-afk/freight-quotes-web/actions/runs/'+runId);
assert.ok(run.jobs.length&&run.jobs.every(x=>x.conclusion==='success'));
const qa=manifest.sh59IsolatedQa;
const backendSha=qa.sourceCommit,backendVersion=qa.version,backendBundle=qa.providerBundleSha256;
const frontendSource=manifest.frontendCommit,sqlMigrationVersion=qa.catalogMigrationVersion||manifest.sqlMigrationVersion;
assert.equal(backendSha,manifest.backendSourceCommit);
assert.equal(qa.businessVersion,manifest.primaryBusinessVersion);
assert.match(backendSha,gitSha);
assert.match(frontendSource,gitSha);
assert.match(backendBundle,hash);
assert.match(sqlMigrationVersion,/^\d{14}$/);

let refs=[],traceId;
function take(file){
 const path=realpathSync(resolve(artifact,file));
 assert.ok(path.startsWith(artifact+sep),'Receipt path outside protected artifact');
 const bytes=readFileSync(path);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 refs.push({file,sha256});
 return {bytes,sha256};
}
const parse=file=>JSON.parse(take(file).bytes);
const pair=parse('carrier124-ci-pair.json');
const sourceSha=pair.frontendMetadata;
assert.match(sourceSha,gitSha);
const root=resolve(import.meta.dirname,'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(sourceSha,git('rev-parse','HEAD'),'Unexpected frontend checkout in the protected run');
assert.equal(pair.frontendTestTree,git('rev-parse','HEAD:test'));
assert.deepEqual(manifest,JSON.parse(git('show','HEAD:test/staging-manifest.json')));
assert.equal(pair.protectedWorkflowSha,run.headSha);
assert.equal(pair.workflowRunId,runId);
assert.equal(pair.frontendSource,frontendSource);
assert.equal(pair.backendSource,backendSha);
assert.equal(pair.version,backendVersion);
assert.equal(pair.bundle,backendBundle);
assert.equal(pair.sqlMigrationVersion,sqlMigrationVersion);
assert.equal(pair.function,qa.function);
assert.equal(pair.readbackCount,qa.sourceFilesVerified);
assert.equal(pair.match,true);

function attestBrowser(e){
 assert.equal(e.frontendSha,sourceSha);
 assert.equal(e.frontendSource,frontendSource);
 assert.equal(e.backendSourceCommit,backendSha);
 assert.equal(e.backendVersion,backendVersion);
 assert.equal(e.backendBundle,backendBundle);
 assert.equal(e.sqlMigrationVersion,sqlMigrationVersion);
 assert.equal(e.workflowRunId,runId);
 assert.equal(e.mocks,false);
 assert.equal(e.immutableSource,true);
 assert.equal(e.sourceTreeDirty,false);
 assert.equal(e.transport,'TLS_VERIFIED_REAL_HTTP');
}
function browser(file,actor){
 const e=parse(file);
 attestBrowser(e);
 const r=e.roles.find(r=>r.actor===actor);
 assert.equal(r?.status,'PASS');
 const http=e.calls.find(call=>call.status===200&&call.method==='POST'&&call.path.startsWith('/api/')&&call.requestId);
 traceId ||= (http??e.calls.find(call=>call.status===200&&call.path.startsWith('/api/')&&call.requestId))?.requestId;
 for(const view of r.viewports){
  assert.match(view.screenshotSha256,hash);
  assert.equal(take(view.screenshot.replace(/^reports\//,'')).sha256,view.screenshotSha256);
 }
 assert.ok(r.viewports.length,'Missing verified browser screenshot');
 return r;
}
const main=(actor,phase)=>browser('isolated-rc/browser-results-'+actor+'-'+phase+'.json',actor);
const create=()=>browser('nov14-published/browser-results-owner-create.json','owner');
const selection=()=>browser('nov14-published/browser-results-owner-select.json','owner');
const winner=prefix=>{const r=browser(prefix+'/browser-results-owner-select.json','owner');assert.ok(['carrierA','carrierB'].includes(r.selection.winnerActor));return r.selection.winnerActor;};
const rail=(actor,phase,prefix='nov14-published')=>browser(prefix+'/browser-results-'+actor+'-nov14-'+phase+'.json',actor).nov14;
function api(id){const e=parse('isolated-rc/business-api-real.json');assert.equal(e.environment,'isolated-qa');assert.equal(e.mode,'AUTHENTICATED_QA_API');assert.equal(e.runId,runId);assert.equal(e.frontendSha,sourceSha);assert.equal(e.frontendSource,frontendSource);assert.equal(e.backendSourceCommit,backendSha);assert.equal(e.backendVersion,backendVersion);assert.equal(e.backendBundle,backendBundle);assert.equal(e.sqlMigrationVersion,sqlMigrationVersion);assert.equal(e.productionDataUsed,false);assert.equal(e.result,'PASS');assert.equal(e.checks.length,9);const c=e.checks.find(c=>c.id===id);assert.equal(c?.status,'PASS');return c.evidence;}
const fields=()=>api('published_fields_files_and_incoterms_survive_owner_edit'),variants=()=>api('multiple_variants_currency_edit_and_stale_write'),late=()=>api('late_preparation_blocks_winner_and_submitted_offer_stays_reviewable'),refusal=()=>api('timely_refusal_requires_reason_and_never_penalizes_service_level');
function security(){const e=parse('isolated-rc/security-gate-real.json');assert.equal(e.mocks,false);assert.equal(e.result,'PASS');assert.equal(e.checks.length,10);assert.ok(e.checks.every(c=>c.result==='PASS'));return e;}
function matrix(){const file='carrier124-full-roles/browser-results-all-cabinet-read.json',e=parse(file);attestBrowser(e);assert.equal(e.roles.length,11);let cells=0;for(const r of e.roles){browser(file,r.actor);assert.equal(r.cabinetMatrixFailures.length,0);assert.deepEqual(r.runtimeErrors,[]);for(const c of r.cabinetMatrix){assert.ok([390,1366].includes(c.width));assert.ok(c.scroll<=c.width+4);assert.equal(c.axe.violations.length,0);assert.equal(take(c.screenshot.replace(/^reports\//,'')).sha256,c.screenshotSha256);cells++;}}assert.equal(cells,96);return e;}
function compatibility(){const e=parse('isolated-rc/previous-production-ui-compatibility.json');assert.equal(e.frontendSha,sourceSha);assert.equal(e.runId,runId);assert.equal(e.result,'PASS');assert.equal(e.productionApiAccessed,false);assert.equal(e.productionWrites,false);assert.equal(e.roles.length,2);assert.ok(e.roles.every(r=>r.status==='PASS'&&r.readOnly===true));assert.equal((e.transportErrors||[]).length,0);return e;}
const required=()=>api('required_fields_server_negatives'),csv=()=>main('carrierA','bid-csv'),xlsx=()=>main('carrierB','bid-xlsx');
const acceptance=()=>browser('nov14-published/browser-results-'+winner('nov14-published')+'-accept.json',winner('nov14-published')).acceptance;
const ordinary=()=>rail('owner','finish','nov14-ordinary');
const rules=[
 ['T1-01','owner',()=>required().serverRejectsMissingFields===true&&required().rejectedFields.length===8&&create().requiredFieldUiValidation.numberOnlyDisabled===true&&create().requiredFieldUiValidation.numberAndDeadlineDisabled===true&&create().publication.http===200],
 ['T1-02','owner+carrier',()=>fields().sourceFieldsAndIncotermPlacePreserved===true&&fields().staleEditDenied===true&&create().publication.http===200],
 ['T1-03','owner+carrier+ved+supplier',()=>fields().ownerOnlyEdit===true&&fields().staleEditDenied===true&&selection().selection.uniqueWinnerReadback===true],
 ['T1-04','owner+carrier',()=>fields().sourceFieldsAndIncotermPlacePreserved===true&&create().publication.http===200],
 ['T1-05','owner+carrier',()=>fields().bitrixNumbers===2&&create().publication.bitrixNumbers===2&&/^TR-/.test(create().publication.registrationNumber)],
 ['T1-06','owner+carrier',()=>fields().uploadedTogether===2&&fields().downloadedByRoles===3&&fields().removedOnce===true&&hash.test(fields().sha256)&&create().fileInputs>0],
 ['T1-07','owner+carrier',()=>create().publication.recipients===2&&selection().selection.notificationId&&csv().quote.http===200&&xlsx().quote.http===200],
 ['T1-08','owner+carrierA+carrierB',()=>fields().downloadedByRoles===3&&fields().sourceFieldsAndIncotermPlacePreserved===true&&csv().quote.readbackVerified===true&&xlsx().quote.readbackVerified===true],
 ['T1-09','owner+carrierA+carrierB+supplier',()=>{security();return acceptance().loserDenied===true;}],
 ['T1-10','all eleven roles',()=>{matrix();return true;}],
 ['T1-11','owner+carrier',()=>{matrix();compatibility();return true;}],
 ['T2-01','carrier+owner',()=>refusal().emptyReasonDenied===true&&refusal().ownerCannotImpersonateCarrier===true&&refusal().resumedBeforeDeadline===true&&csv().quote.http===200],
 ['T2-02','all eleven roles',()=>{security();return acceptance().loserDenied===true&&acceptance().vedDeniedBefore===true;}],
 ['T2-03','certification+owner+carrier',()=>{const e=api('two_sessions_and_three_wrong_passwords');return e.oldSessionRevoked===true&&e.maximumActiveSessions===2&&e.wrongAttempts===3&&e.recoveryRequested===true&&csv().quote.http===200;}],
 ['T2-04','owner+carrier',()=>late().winnerSelectedAfterSubmission===true&&late().lateVariants===2&&acceptance().vedAvailableAfter===true],
 ['T2-05','owner+carrier',()=>variants().variants===2&&variants().replayDidNotDuplicate===true&&xlsx().workbookImport.previewConfirmed===true],
 ['T2-06','owner+carrier',()=>variants().currency==='EUR'&&variants().staleWrite===409&&variants().forbiddenRoles===3&&variants().sourceFieldsPreserved===true&&selection().selection.comparedBids===2],
 ['T2-07','carrierB',()=>xlsx().workbookImport.status==='PASS'&&xlsx().workbookImport.previewConfirmed===true&&xlsx().workbookImport.importDidNotSubmit===true&&xlsx().quote.readbackVerified===true],
 ['T2-08','carrierA',()=>csv().csvImport.utf8Bom===true&&csv().csvImport.invalidDateRejectedAtomically===true&&csv().csvImport.previewConfirmed===true&&csv().csvImport.importDidNotSubmit===true&&csv().quote.readbackVerified===true],
 ['T2-09','carrier+owner',()=>refusal().timelyRefusalNoPenalty===true&&refusal().resumedBeforeDeadline===true&&late().applicationClockUnchanged===true&&csv().quote.http===200],
 ['T2-10','carrier+owner',()=>late().lateVariants===2&&late().lateBidDoesNotRestoreScore===true&&late().onePenaltyEvent===true&&selection().selection.uniqueWinnerReadback===true],
 ['T2-11','carrier+owner',()=>late().activePreparationWinnerStatus===409&&late().winnerSelectedAfterSubmission===true&&selection().selection.uniqueWinnerReadback===true],
 ['T2-12','owner',()=>selection().selection.comparedBids===2&&selection().selection.uniqueWinnerReadback===true],
 ['T2-13','owner+winner+loser',()=>selection().selection.uniqueWinnerReadback===true&&acceptance().loserDenied===true&&acceptance().http===200],
 ['T2-14','owner+carriers',()=>{const a=api('competitive_tender_step_final_protocol_and_role_guard'),p=main('owner','cabinet-read').tenderPdf;return a.step===15&&a.acceptedImprovement===20&&a.duplicateOfferProtected===true&&a.final===true&&p.status==='PASS'&&p.serverValuesVerifiedInPdf===true&&p.final===true;}],
 ['T2-15','owner+carrier+ved',()=>selection().selection.notificationId&&late().onePenaltyEvent===true&&rail('ved','remarks').replayAndReloadDeduplicated===true],
 ['T2-16','carrier+ved',()=>acceptance().vedDeniedBefore===true&&acceptance().vedAvailableAfter===true&&acceptance().http===200&&rail('owner','claim-open').noticeSentWithoutFormalAct===true],
 ['T2-17','carrier+owner',()=>{const x=rail(winner('nov14-published'),'carrier');return x.futureRejected===true&&x.fourReschedules===true&&x.weeklyRows===10&&x.stationPoints===2&&x.reloadPreserved===true&&x.mutationsAfterReload===0;}],
 ['T2-18','owner+carrier+ved',()=>{const modes=main('carrierA','mode-matrix').modeMatrix;const a=api('sea_air_multimodal_shipments_retain_actual_tracking_without_guessed_coordinates');return modes.length===3&&modes.every(m=>m.noGuessedCoordinates===true&&m.reloadPreserved===true&&m.screenshots.length===4)&&a.unchangedReplay===true&&a.roleDenials===true&&rail(winner('nov14-published'),'carrier').routeStops===4;}],
 ['T2-19','owner+carrier+ved+logistic',()=>{const v=main('ved','ved-work'),p=main('ved','ved-verify').persistence,l=main('logistic','logistic-document').documentHandoff,s=main('logistic','logistic-security').addressedSecurity;return v.sharedChat.realRecipients===3&&v.sharedChat.files===1&&v.sharedChat.loserDenied===true&&p.draftPreserved===true&&p.reloadVerified===true&&p.submissionRequests===0&&l.completed===true&&l.wrongActorDenied===true&&l.ptoReviewUnchanged===true&&s.retryDeduplicated===true&&s.ptoUnchanged===true;}],
 ['T2-20','owner+carrier+ved',()=>rail('owner','start-review').reviewTask===rail('ved','remarks').sameOpenTask&&rail('ved','remarks').sameOpenTask===rail('ved','approve').approvedTask&&rail('ved','remarks').remarksDeliveredToThreeRoles===true&&rail(winner('nov14-published'),'stages').stagesSaved===true],
 ['T2-21','owner+carrier',()=>rail(winner('nov14-published'),'stages').stagesSaved===true&&ordinary().ordinaryCompletion.noContainer===true&&ordinary().ordinaryCompletion.explicitOwnerDecision===true&&ordinary().ordinaryCompletion.replayIdempotent===true],
 ['T2-22','owner+carrier',()=>ordinary().ordinaryCompletion.noClaim===true&&ordinary().ordinaryCompletion.carrierDenied===true&&ordinary().completedAndArchived===true&&ordinary().dashboardAgrees===true&&rail('owner','approve-cost','nov14-ordinary').finalCostApproved.ownerOnly===true],
 ['T2-23','owner+carrier',()=>rail('owner','claim-open').noticeSentWithoutFormalAct===true&&rail(winner('nov14-published'),'claim-propose').carrierProposed===true&&rail('owner','claim-approve').exactProposalApproved===true&&rail(winner('nov14-published'),'claim-fulfill').freshOwnProofSubmitted===true&&rail('owner','claim-resolve').claimSettledWithoutAutomaticShipmentCompletion===true&&rail('owner','finish').completedAndArchived===true&&rail('owner','approve-cost-revision').finalCostApproved.staleApprovalDenied===true],
 ['T2-24','carrier+owner',()=>late().onePenaltyEvent===true&&late().lateBidDoesNotRestoreScore===true&&refusal().timelyRefusalNoPenalty===true&&csv().quote.http===200],
 ['T2-25','owner+carrier+ved',()=>fields().sourceFieldsAndIncotermPlacePreserved===true&&fields().bitrixNumbers===2&&variants().sourceFieldsPreserved===true&&create().publication.bitrixNumbers===2&&rail('owner','finish').dashboardAgrees===true],
 ['T2-26','all eleven roles',()=>{matrix();compatibility();const x=main('owner','alignment');return x.alignment.processEditor.reopened===true&&x.alignment.processEditor.approvedModelUnchanged===true&&x.publicSupport.publicFormSubmitted===true&&x.publicSupport.foreignReadsAndWritesDenied===true;}]
];
assert.equal(rules.length,37);assert.equal(new Set(rules.map(r=>r[0])).size,37);
const scenarios=rules.map(([id,actorRole,check])=>{
 refs=[];
 traceId=null;
 let pass=false,error;
 try{
  assert.ok(check(),'Required observed property missing');
  assert.match(traceId||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,'Missing real HTTP request ID');
  assert.ok(refs.some(r=>r.file.includes('browser-results-'))&&refs.some(r=>r.file.endsWith('.png')),'Missing browser and screenshot evidence');
  pass=true;
 }catch(e){
  error=e.code==='ENOENT'?'Missing protected artifact member: '+(e.path||'').replace(artifact+sep,''):e.message;
 }
 const sources=[...new Map(refs.map(r=>[r.file,r])).values()];
 return {id,status:pass?'PASS':'BLOCKED',mode:'AUTHENTICATED_QA_API',actorRole,
  evidence:{method:'HTTP_AND_BROWSER',responseVerified:pass,traceId,sources,
   ...(id==='T1-01'?{negativeValidation:pass,serverRejectsMissingFields:pass}:{})},
  ...(error?{blockedReason:error}:{})};
});
const blocked=scenarios.filter(x=>x.status!=='PASS');
const e2e={environment:'isolated-qa',authorized:true,runId,frontendSha:sourceSha,frontendSource,backendSha,
 backendVersion,backendBundle,sqlMigrationVersion,artifactId:run.url,scenarios,
 criticalDefects:blocked.length?['Acceptance evidence remains incomplete']:[]};
mkdirSync(out,{recursive:true});writeFileSync(out+'/private-authenticated-e2e.json',JSON.stringify(e2e,null,2)+'\n');
console.log('AUTHENTICATED_ACCEPTANCE',scenarios.length-blocked.length+'/37');for(const x of blocked)console.log('BLOCKED',x.id,x.blockedReason||'Required observed property missing');if(blocked.length)process.exitCode=1;
