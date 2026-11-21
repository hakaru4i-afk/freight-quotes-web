import test from 'node:test';
import assert from 'node:assert/strict';
import {planCarrierBRecovery, recoverVerifiedCarrierB} from '../scripts/qa20-sl-recovery-guard.mjs';

const login = 'carrier124nov18-carrierb';
const owner = 'carrier124nov18-owner';
const boundary = 'Controlled synthetic QA score for the acceptance boundary';
const restore = 'Restore simulated Carrier B after acceptance test';
const id = n => 'f0000000-0000-0000-0000-' + String(n).padStart(12, '0');
const oidcOrder = 'QA-N26-OIDC-44719119692-1';
const make = () => ({revision:38, policy:{score:79,blocked:false}, corrections:[{
  id:'821bd963-7605-4187-93b6-dec21b5b50fa', login, actor:owner, revision:38, after_seq:30,
  action:'set_score', value:79, event_id:null, score_before:64, score_after:79,
  reason:'Restore audited isolated QA Carrier B synthetic no-response penalties after revision 37'
}],events:[{id:id(30),seq:30}]});
function expire(ledger, order=oidcOrder) {
  const seq=ledger.events.at(-1).seq+1;
  const score=ledger.policy.score;
  ledger.events.push({id:id(seq),seq,login,kind:'no_response',actor:'system',source_kind:'request',
    event_key:'response-missing:'+id(seq+1000),order_code:order,source_id:id(seq+2000),
    requested_delta:-3,score_before:score,score_after:score-3});
  ledger.policy.score-=3;
  ledger.policy.blocked ||= ledger.policy.score<=50;
  return ledger;
}
function adjust(ledger,value,reason,idValue) {
  ledger.corrections.push({id:idValue??id(++ledger.revision + 3000),login,actor:owner,revision:ledger.revision,
    action:'set_score', value, event_id:null, after_seq:ledger.events.at(-1).seq,
    score_before:ledger.policy.score,score_after:value,reason});
  ledger.policy.score=value;
  ledger.policy.blocked ||= value<=50;
}
function unlock(ledger, reason) {
  const previous=ledger.events.at(-1);
  const seq=previous.seq+1;
  ledger.events.push({id:id(seq),seq,login,kind:'owner_unlock',actor:owner,source_kind:'service',source_id:login,
    order_code:'',event_key:'unlock:'+login+':'+previous.id,reason,requested_delta:51-ledger.policy.score,
    score_before:ledger.policy.score,score_after:51});
  ledger.policy={score:51,blocked:false};
}
function client(ledger,{wrongSummary=false,beforeWrite=async()=>{}}={}) {
  const actions=[];
  const receipts=new Set();
  async function api(actor, path, query, body) {
    assert.equal(actor,'owner');
    if(path==='/api/requests'){
      const request=ledger.events.find(event=>event.order_code===query.order);
      return {json:{request:{order_code:query.order,round_id:request.source_id,
        summary:wrongSummary?'External customer order':'Isolated QA OIDC '+query.order}}};
    }
    assert.equal(path,'/api/service-level');
    assert.equal(body?.login??query.login,login);
    if(!body)return {json:structuredClone(ledger)};
    if(body.action==='unlock'){
      assert.deepEqual([body.guaranteeId,body.resultId],['proof-a','proof-b']);
      if(!ledger.policy.blocked)return {status:409};
      unlock(ledger,body.reason);
    }else{
      assert.equal(body.action,'set_score');
      await beforeWrite(body);
      if(receipts.has(body.requestId))return {status:200};
      if(ledger.revision!==body.expectedRevision)return {status:409};
      receipts.add(body.requestId);
      ledger.revision++;
      adjust(ledger,body.value,body.reason,body.requestId);
    }
    actions.push(body.action);
    return {status:200};
  }
  return {api,actions};
}
const proof = async()=>({guaranteeId:'proof-a',resultId:'proof-b'});

test('recovers after ordinary boundary restore and newly expired isolated requests at changing revisions',async()=>{
  const ledger=expire(make(),'QA-N26-OIDC-44717285977-1');
  for(const value of [76,75,51,50])adjust(ledger,value,boundary);
  unlock(ledger,restore);
  adjust(ledger,76,restore);
  expire(ledger,oidcOrder);
  assert.deepEqual([ledger.revision,ledger.policy.score],[43,73]);
  const c=client(ledger);
  const first=await recoverVerifiedCarrierB(c.api,proof);
  assert.deepEqual([first.initialScore,first.score,first.verifiedSyntheticOrders,first.revision],[73,79,2,44]);
  assert.deepEqual(c.actions,['set_score']);
  assert.equal((await recoverVerifiedCarrierB(c.api,proof)).recoveryRequired,false);
  assert.equal(ledger.revision,44);
  expire(ledger,'QA-N26-OIDC-44895015718-1');
  assert.equal((await recoverVerifiedCarrierB(c.api,proof)).revision,45);
  assert.equal(ledger.events.length,5);
});

test('unlocks an interrupted verified boundary with the two synthetic documents and restores once',async()=>{
  const ledger=make();
  for(const value of [76,75,51,50])adjust(ledger,value,boundary);
  const c=client(ledger);
  const first=await recoverVerifiedCarrierB(c.api,proof);
  assert.equal(first.score,79);
  assert.equal((await recoverVerifiedCarrierB(c.api,proof)).recoveryRequired,false);
  assert.deepEqual(c.actions,['unlock','set_score']);
});

for(const [title,edit,error] of [
  ['a real order', c=>c.events[1].order_code='REAL-ORDER-123', /QA_SL_ORDER_NOT_APPROVED/],
  ['an altered actor', c=>c.events[1].actor='other', /QA_SL_EVENT_PROVENANCE/],
  ['an unknown event', c=>c.events[1].kind='manual_penalty', /UNRECOGNIZED_QA_SL_EVENT/],
  ['an unexplained score', c=>c.policy.score=75, /QA_SL_POLICY_DRIFT/],
  ['a duplicate event key', c=>c.events.push({...c.events[1],seq:32,id:id(32)}), /DUPLICATE_QA_SL_EVENT/],
  ['a duplicate order with another event key', c=>expire(c,oidcOrder), /DUPLICATE_QA_SL_ORDER_EVENT/],
  ['an unauthorized correction', c=>adjust(c,79,'Manual score reset'), /QA_SL_CORRECTION_REASON/]
]){
  test('rejects '+title,()=>{const ledger=expire(make());edit(ledger);assert.throws(()=>planCarrierBRecovery(ledger),error);});
}

test('a synthetic-looking number with real request metadata cannot be changed',async()=>{
  const ledger=expire(make());
  const c=client(ledger,{wrongSummary:true});
  await assert.rejects(recoverVerifiedCarrierB(c.api,proof),/QA_SL_SYNTHETIC_REQUEST_READBACK_MISMATCH/);
  assert.deepEqual(c.actions,[]);
});

test('concurrent recovery writes one optimistic correction with a shared request ID',async()=>{
  const ledger=expire(make());
  const mutations=[];
  let ready;
  const both = new Promise(resolve=>{ready=resolve;});
  const c=client(ledger,{beforeWrite:async body=>{
    mutations.push(body);
    if(mutations.length===2)ready();
    await both;
  }});
  await Promise.all([recoverVerifiedCarrierB(c.api,proof),recoverVerifiedCarrierB(c.api,proof)]);
  assert.equal(mutations[0].requestId,mutations[1].requestId);
  assert.equal(mutations[0].expectedRevision,38);
  assert.deepEqual(c.actions,['set_score']);
  assert.equal(ledger.revision,39);
});
