import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recoverInterruptedCarrierBoundary } from './carrier124-remaining-api.mjs';

const fixes = [79,76,75,51,50].map((value,index)=>({
  revision:22+index,value,after_seq:18,action:'set_score',actor:'carrier124nov18-owner',
  reason:'Controlled synthetic QA score for the acceptance boundary'
}));
const missed = (seq,order_code)=>({seq,order_code,kind:'no_response',source_kind:'request',
  actor:'system',requested_delta:-3});
const overdue = [
  missed(19,'QA-N26-OIDC-44586140745'),
  missed(20,'QA-N26-OIDC-44587837976')
];
const pendingB = events=>({revision:26,corrections:fixes,events,policy:{score:44,blocked:true}});

test('restore the exact expired synthetic fixtures and preserve audit history', async()=>{
  const b=pendingB(overdue);
  const abandonedA={...missed(20,'QA-CI-FE0D4777-LATE-626BDF21'),id:'miss-a',score_before:79,corrected:false};
  const a={revision:0,events:[abandonedA],policy:{score:76,blocked:false}};
  const commands=[];
  const documents=['n26-guarantee.txt','n26-result.txt'].map((name,index)=>({id:'proof-'+index,name}));
  async function api(actor,path,query,body){
    assert.equal(actor,'owner');
    if(path==='/api/documents')return {json:{files:documents}};
    if(path==='/api/documents/file'){
      const document=documents.find(row=>row.id===query.id);
      return {bytes:Buffer.from('Synthetic SL restoration proof '+document.name)};
    }
    assert.equal(path,'/api/service-level');
    if(!body)return {json:query.login.endsWith('carriera')?a:b};
    commands.push(body.action);
    if(body.action==='unlock'){
      assert.equal(body.guaranteeId,'proof-0');
      assert.equal(body.resultId,'proof-1');
      b.policy={score:51,blocked:false};
    }else if(body.action==='set_score'){
      assert.deepEqual([body.expectedRevision,body.value],[26,79]);
      b.policy.score=body.value;
    }else{
      assert.equal(body.action,'void_event');
      assert.equal(body.eventId,abandonedA.id);
      abandonedA.corrected=true;
      a.policy.score=79;
    }
    return {json:{ok:true}};
  }
  const result=await recoverInterruptedCarrierBoundary(api);
  assert.deepEqual(commands,['unlock','set_score','void_event']);
  assert.equal(result.carrierB.score,79);
  assert.equal(result.carrierA.score,79);
  assert.equal(abandonedA.corrected,true);
  assert.deepEqual(b.events,overdue);
});

test('a different penalty makes recovery fail before any mutation',async()=>{
  const b=pendingB([overdue[0],missed(20,'QA-N26-OTHER')]);
  let reads=0;
  await assert.rejects(recoverInterruptedCarrierBoundary(async(actor,path,query,body)=>{
    ++reads;
    assert.equal(path,'/api/service-level');
    assert.equal(body,undefined);
    return {json:b};
  }),/Unexpected penalty after Carrier B test revision 26/);
  assert.equal(reads,1);
});
