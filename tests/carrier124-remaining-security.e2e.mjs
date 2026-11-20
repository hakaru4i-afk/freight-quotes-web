import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRemainingClient, loadRemainingRun, publishFixture, sha256} from './carrier124-remaining-api.mjs';

const {sessions, save}=await loadRemainingRun();
const calls=[], checks=[];
const api=await createRemainingClient(sessions,calls);
const mode=process.argv[2];
const keys={carrierA:'QA-N26-SEC-A1',carrierB:'QA-N26-SEC-B1'};
const digest = order => sha256(Buffer.from('Synthetic control file '+order+'\n'));
const deny=[401,403,404];
const excluded=(result,markers)=>{
  const payload=JSON.stringify(result.json);
  for(const marker of markers){
    assert.match(marker,/^[A-Za-z0-9-]+$/);
    assert.ok(!new RegExp('(?<![A-Za-z0-9-])'+marker+'(?![A-Za-z0-9-])').test(payload),'Foreign fixture data returned: '+marker);
  }
};
async function check(id,execute) {
  try {checks.push({id,status:'PASS',...await execute()});}
  catch(error){checks.push({id,status:'FAIL',error:error.message});process.exitCode=1;}
}
async function supplierFixture(actor){
  const order='QA-N26-SEC-'+actor.toUpperCase(), label=actor+' synthetic signed proforma';
  const catalog=await api(actor,'/api/supplier-orders');
  let id=catalog.json.orders?.find(x=>x.order_code===order)?.id;
  if(!id){
    const data=new FormData();
    for(const [key,val] of Object.entries({action:'create',order,supplier:'carrier124nov18-'+actor.toLowerCase(),requestId:randomUUID(),kind:'proforma'}))data.set(key,val);
    data.set('file',new Blob([label],{type:'text/plain'}),'qa-proforma.txt');
    id=(await api('owner','/api/supplier-orders',{},data)).json.id;
  }
  const detail=await api('owner','/api/supplier-orders',{id});
  return {order,id,file:detail.json.files[0].id,sha:sha256(label)};
}
if(Object.hasOwn(keys,mode)){
  await check(mode,async()=>{
    const fixture=await publishFixture(api,keys[mode]);
    // The current Owner request contract broadcasts to every eligible carrier (two QA carriers).
    // Carrier-to-carrier denial is only valid for truly unassigned orders, not this shared round.
    assert.equal(fixture.published.recipients,2,'Default publication must reach both eligible QA carriers');
    return {order:fixture.order,round:fixture.published.round};
  });
}else if(mode==='verify'||mode==='supplier'){
  if(mode==='verify')await check('T1-09',async()=>{
    const docs={};
    for(const [actor,order] of Object.entries(keys)){
      const response=await api('owner','/api/documents',{order});
      docs[actor]={id:response.json.files.find(f=>f.name==='qa-control.txt').id, access:response.json.access};
    }
    const checks=[];
    for(const [actor,order] of Object.entries(keys)){
      const other=actor==='carrierA'?'carrierB':'carrierA', shared=keys[other];
      const own=await api(actor,'/api/requests',{order});
      assert.equal(own.json.request.order_code,order);
      const receipt=await api(actor,'/api/documents/file',docs[actor]);
      assert.equal(sha256(receipt.bytes),digest(order));
      // Both carriers were explicitly notified by the broadcast contract:
      // it would be wrong to assert that an assigned carrier is unauthorized.
      const second=await api(actor,'/api/requests',{order:shared});
      assert.equal(second.json.request.order_code,shared);
      const secondFile=await api(actor,'/api/documents/file',docs[other]);
      assert.equal(sha256(secondFile.bytes),digest(shared));
      const list=await api(actor,'/api/carrier');
      for(const code of Object.values(keys))assert.ok(list.json.notifications.some(n=>n.order_code===code),'Missing broadcast recipient '+code);
      // Test an actual authorization boundary: anonymous users and suppliers,
      // who are not participants in either transport request, must be denied.
      for(const outsider of [null,'supplier','supplierB']){
        await api(outsider,'/api/requests',{order},undefined,deny);
        await api(outsider,'/api/documents',{order,access:docs[actor].access},undefined,deny);
        await api(outsider,'/api/documents/file',docs[actor],undefined,deny);
      }
      checks.push({actor,ownFileSha256:digest(order),assignedOrders:[order,shared],deniedRoles:['anonymous','supplier','supplierB']});
    }
    return {checks};
  });
  await check('T2-02',async()=>{
    const a=await supplierFixture('supplier'), b=await supplierFixture('supplierB');
    for(const [actor,own,foreign] of [['supplier',a,b],['supplierB',b,a]]){
      const profile=await api(actor,'/api/session');
      assert.equal(profile.json.role,'supplier');
      assert.equal(sha256((await api(actor,'/api/supplier-files',{id:own.file})).bytes),own.sha);
      await api(actor,'/api/supplier-orders',{id:foreign.id},undefined,deny);
      await api(actor,'/api/supplier-orders',{id:foreign.id,chat:1},undefined,deny);
      await api(actor,'/api/supplier-files',{id:foreign.file},undefined,deny);
      excluded(await api(actor,'/api/supplier-orders'),[foreign.id,foreign.order,foreign.file]);
    }
    const order='QA-CI-18E8AAF6-MULTI-95CAED84';
    const own=await api('ved','/api/task2',{order});
    assert.equal(own.json.shipment.order_code,order);
    for(const actor of [null,'carrierB','supplier','supplierB','logistic']){
      await api(actor,'/api/task2',{order},undefined,deny);
      await api(actor,'/api/task2',{}, {order,action:'container',number:'QA-N26-DENIED'},deny);
    }
    for(const actor of [null,'supplier','supplierB','logistic']){
      await api(actor,'/api/documents',{order:keys.carrierA},undefined,deny);
    }
    return {supplierFixtures:[a,b],protectedShipment:order};
  });
}else throw Error('Choose carrierA, carrierB or verify');
await save('security-'+mode+'.json',{checks,calls});
for(const check of checks)console.log(check.status,check.id,check.error||'');
