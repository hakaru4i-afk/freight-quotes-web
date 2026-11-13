// Real authenticated mutation/readback against synthetic isolated fixtures only.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const evidence=process.env.QA_BROWSER_EVIDENCE_DIR||'reports/map50-final';
const source=JSON.parse(await readFile(evidence+'/browser-results-owner.json','utf8')).roles[0];
const order=source.createdOrder;
assert.match(order,/^QA-/);
const sessions=JSON.parse(await readFile(process.env.QA_SESSIONS_FILE||'/tmp/freight-rc20261110-private/sessions.json','utf8'));
const base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
async function api(path,body,method='POST',actor='owner'){
 const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?method:'GET',headers:{Origin:'https://hakaru4i-afk.github.io','Content-Type':'application/json',Authorization:'Bearer '+sessions[actor]},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
 return{status:r.status,data:await r.json()};
}
const details=async()=>{const r=await api('/api/task2?order='+order);assert.equal(r.status,200);return r.data;};
const before=await details(),request=(await api('/api/requests?order='+order)).data.request;
const events=[];
async function ownerOrigin(origin,expectedRevision){
 const r=await api('/api/requests',{action:'save_logistics',order,roundId:request.round_id,expectedRevision,logistics:{...request,origin}});
 assert.equal(r.status,200,JSON.stringify(r));
 const after=await details(),p=after.plannedGeocodes.owner.find(p=>p.point_role==='origin');
 assert.equal(p.original_text,origin);assert.equal(p.status,'resolved');
 events.push({action:'owner_address_edit',origin,http:r.status,point:p});return after;
}
let changed=false;
try{
 changed=true;await ownerOrigin('China, Ningbo',request.logistics_revision);
 const conflict=await api('/api/requests',{action:'save_logistics',order,roundId:request.round_id,expectedRevision:request.logistics_revision,logistics:request});assert.equal(conflict.status,409);
}finally{if(changed){const fresh=(await api('/api/requests?order='+order)).data.request;await ownerOrigin(request.origin,fresh.logistics_revision);}}
const bids=(await api('/api/data')).data.bids,old=bids.find(b=>b.id===source.selection.bidId);assert.ok(old);
const fields=['carrier','contact','mode','amount','currency','route','pickup','days','insurance','includes','extras','valid_until','note','origin','destination','waypoints','weight'];
const values=b=>Object.fromEntries(fields.map(k=>[k,b[k]]));
async function editBid(from,waypoints){
 const r=await api('/api/bids',{id:old.id,expected:values(from),...values(from),waypoints},'PATCH');assert.equal(r.status,200,JSON.stringify(r));
 const d=await details();assert.deepEqual(d.plannedGeocodes.offer.filter(p=>p.point_role==='waypoint').map(p=>p.original_text),waypoints.split('\n'));assert.ok(d.plannedGeocodes.offer.every(p=>p.status==='resolved'));
 const saved=(await api('/api/data')).data.bids.find(b=>b.id===old.id);events.push({action:'bid_route_edit',waypoints,http:r.status,geocodes:d.plannedGeocodes.offer});return saved;
}
const temporary=old.waypoints.includes('Шанхай')?'Китай, Нинбо\nБеларусь, Брест':'Китай, Шанхай\nБеларусь, Брест';
let edited;
try{edited=await editBid(old,temporary);const denied=await api('/api/bids',{id:old.id,expected:values(edited),...values(edited)},'PATCH',source.selection.winnerActor);assert.equal(denied.status,403);}
finally{const fresh=(await api('/api/data')).data.bids.find(b=>b.id===old.id);if(fresh.waypoints!==old.waypoints)await editBid(fresh,old.waypoints);}
const after=await details();assert.deepEqual(after.points.map(p=>p.id),before.points.map(p=>p.id));assert.deepEqual(after.plannedGeocodes.owner.map(p=>p.original_text),before.plannedGeocodes.owner.map(p=>p.original_text));
await writeFile(evidence+'/map50-real-edits.json',JSON.stringify({result:'PASS',order,events,staleRevisionDenied:true,carrierEditDenied:true,trackingPreserved:true,originalRouteRestored:true},null,2)+'\n');
console.log('MAP50_REAL_EDITS_PASS');
