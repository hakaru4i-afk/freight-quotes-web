import assert from 'node:assert/strict';

// Only the exact known synthetic QA sequence observed in the isolated carrier124nov18 schema.
// Production and shared staging must never use this recovery guard.
const orders=[
  'QA-N26-OIDC-44704978802-1',
  'QA-N26-OIDC-44707103378-1',
  'QA-N26-OIDC-44709317018-1',
  'QA-N26-OIDC-44714823837-1'
];
export function validateKnownCarrierBSlRecovery(current){
  if(Number(current.revision)!==37)return false;
  assert.equal(current.policy.score,64,'UNRECOGNIZED_CARRIER_B_SCORE');
  assert.equal(current.policy.blocked,false,'UNRECOGNIZED_CARRIER_B_BLOCK');
  const corrections=current.corrections.slice(-5);
  assert.deepEqual(corrections.map(x=>Number(x.revision)),[33,34,35,36,37]);
  assert.deepEqual(corrections.map(x=>Number(x.value)),[76,75,51,50,76]);
  assert.ok(corrections.every((x,i)=>x.action==='set_score'&&
    x.actor==='carrier124nov18-owner'&&
    x.reason===(i===4?'Restore simulated Carrier B after acceptance test':'Controlled synthetic QA score for the acceptance boundary')));
  assert.equal(Number(corrections.at(-1).after_seq),26);
  const events=current.events.filter(e=>Number(e.seq)>26);
  assert.deepEqual(events.map(e=>Number(e.seq)),[27,28,29,30]);
  let score=76;
  for(let i=0;i<orders.length;i++){
    const e=events[i];
    assert.equal(e.kind,'no_response');
    assert.equal(e.source_kind,'request');
    assert.equal(e.actor,'system');
    assert.equal(e.order_code,orders[i]);
    assert.equal(Number(e.requested_delta),-3);
    score-=3;
  }
  assert.equal(current.policy.score,score,'CARRIER_B_EVENT_SCORE_DRIFT');
  return true;
}
