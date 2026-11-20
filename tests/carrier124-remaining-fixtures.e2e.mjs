import assert from 'node:assert/strict';
import {createRemainingClient, loadRemainingRun, verifyServiceBoundaries} from './carrier124-remaining-api.mjs';

const {sessions, save}=await loadRemainingRun();
const calls=[];
const api=await createRemainingClient(sessions,calls);
const claims='QA-CI-18E8AAF6-AIR-289CC1EF';
const container='QA-CI-18E8AAF6-MULTI-95CAED84';
const mode=process.argv[2];
try{
  if(mode==='prepare'){
    for(const order of [claims,container]){
      const receipt=await api('owner','/api/task2',{}, {order,action:'manual_pto_review',reason:'Existing isolated tracking point without a supported calculation',evidence:'Synthetic QA package 1 shipment with recorded point'});
      await api('ved','/api/task2',{}, {order,action:'complete_task',taskId:receipt.json.taskId,reviewDecision:'approve',packageComplete:true});
      const recent=min=>new Date(Date.now()-min*60000).toISOString();
      await api('carrierA','/api/task2',{}, {order,action:'save',fields:{pto_yes:true,pto_date:recent(30),customs_date:recent(25),warehouse_date:recent(20)}});
      const r=(await api('carrierA','/api/task2',{order})).json;
      const cost={order,amount:'781.50',currency:r.shipment.currency};
      const saved=await api('carrierA','/api/task2',{}, {...cost,action:'final_cost_submit',expectedRevision:r.state.final_cost_revision||0});
      await api('owner','/api/task2',{}, {...cost,action:'final_cost_confirm',expectedRevision:saved.json.revision});
      assert.equal((await api('owner','/api/task2',{order})).json.canClose,true);
    }
  }else if(mode==='act-versions'){
    const order=claims;
    const command=(actor,action,body={},status=200)=>api(actor,'/api/task2',{}, {order,action,...body},status);
    const first=await command('owner','act_send',{data:{description:'Synthetic formal act version one'}});
    const actId=first.json.act;
    await command('carrierB','act_response',{actId,revision:1,response:'accept'},[403,404]);
    await command('carrierA','act_response',{actId,revision:1,response:'dispute'},400);
    await command('carrierA','act_response',{actId,revision:1,response:'dispute',reason:'Synthetic documented objection to the first act'});
    await command('owner','act_send',{expectedRevision:1,data:{description:'Synthetic formal act version two'}});
    await command('carrierA','act_response',{actId,revision:1,response:'accept'},409);
    await command('carrierA','act_response',{actId,revision:2,response:'accept'});
    const readback=(await api('owner','/api/task2',{order})).json;
    const act=readback.acts.find(a=>a.id===actId);
    assert.equal(act.revision,2);
    assert.equal(act.state,'accepted');
    assert.equal(readback.claim.state,'disputed');
    await command('owner','claim_close',{},409);
    await command('carrierA','claim_close',{},403);
  }else if(mode==='sl'){
    const scores=await verifyServiceBoundaries(api);
    await save('sl-bounds.json',{scores,calls});
  }else throw Error('Choose prepare, act-versions or sl');
  await save('security-'+mode+'.json',{mode,status:'PASS',calls});
  console.log('PASS',mode);
}catch(e){
  await save('security-'+mode+'.json',{mode,status:'FAIL',error:e.message,calls});
  console.log('FAIL',mode,e.message);
  process.exitCode=1;
}
