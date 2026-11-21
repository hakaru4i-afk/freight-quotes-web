import test from 'node:test';
import assert from 'node:assert/strict';
import {validateKnownCarrierBSlRecovery} from '../scripts/qa20-sl-recovery-guard.mjs';

const orders=['44704978802','44707103378','44709317018','44714823837'];
const make=()=>({
  revision:37,policy:{score:64,blocked:false},
  corrections:[33,34,35,36,37].map((revision,i)=>({
    revision,value:[76,75,51,50,76][i],action:'set_score',
    actor:'carrier124nov18-owner',after_seq: i===4?26:25,
    reason:i===4?'Restore simulated Carrier B after acceptance test':'Controlled synthetic QA score for the acceptance boundary'
  })),
  events:orders.map((id,i)=>({seq:27+i,kind:'no_response',source_kind:'request',actor:'system',
    order_code:'QA-N26-OIDC-'+id+'-1',requested_delta:-3}))
});
test('accepts exactly audited 37th QA correction and four expired synthetic orders',()=>{
  assert.equal(validateKnownCarrierBSlRecovery(make()),true);
});
test('does not rewrite earlier QA recovery revisions',()=>{
  const c=make();c.revision=26;assert.equal(validateKnownCarrierBSlRecovery(c),false);
});
for(const [title,edit] of [
  ['wrong synthetic order',c=>c.events[2].order_code='REAL-ORDER'],
  ['tampered actor',c=>c.events[0].actor='other'],
  ['missing penalty',c=>c.events.pop()],
  ['unexpected event',c=>c.events.push({...c.events[3],seq:31})],
  ['different revision',c=>c.corrections[4].revision=38],
  ['different correction purpose',c=>c.corrections[4].reason='other'],
  ['different latest event offset',c=>c.corrections[4].after_seq=25],
  ['wrong score',c=>c.policy.score=67],
  ['blocked carrier',c=>c.policy.blocked=true]
]){
  test('rejects '+title,()=>{const c=make();edit(c);assert.throws(()=>validateKnownCarrierBSlRecovery(c));});
}
