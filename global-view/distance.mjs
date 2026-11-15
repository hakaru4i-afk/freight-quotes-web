// Staging-only route distances. OSRM public demo is NOT a production SLA.
// Distances are measured on the road network; no straight-line substitute.
const ROUTER='https://router.project-osrm.org';
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);
export async function calculateMapDistances(route,{signal,fetchImpl=fetch}={}){
 const stops=route.stops||[],mode=route.mode;
 const legs=stops.slice(1).map((to,i)=>({from:stops[i].label,to:to.label,status:'unavailable',km:null,reason:'ROUTE_UNAVAILABLE'}));
 if(mode!=='road')return {status:'unavailable',totalKm:null,knownKm:0,legs:legs.map(x=>({...x,reason:mode==='multi'?'LEG_MODES_REQUIRED':'NETWORK_ROUTER_REQUIRED'}))};
 let knownMeters=0;
 for(let i=0;i<legs.length;i++){
  const a=stops[i].position,b=stops[i+1].position;
  if(a?.queryScope==='configured-private'||b?.queryScope==='configured-private'){legs[i].reason='PRIVATE_ROUTER_REQUIRED';continue}
  if(!valid(a)||!valid(b)){legs[i].reason='COORDINATES_MISSING';continue}
  if(a.lat===b.lat&&a.lng===b.lng){legs[i]={...legs[i],status:'calculated',km:0,reason:null,estimated:!!(a.approximate||b.approximate),source:'identical coordinates'};continue}
  try{
   const coords=`${a.lng},${a.lat};${b.lng},${b.lat}`;
   const response=await fetchImpl(`${ROUTER}/route/v1/driving/${coords}?overview=false&steps=false`,{signal});
   if(!response.ok)throw Error('ROUTER_HTTP_'+response.status);
   const data=await response.json(),meters=data?.routes?.[0]?.distance;
   if(data.code!=='Ok'||!Number.isFinite(meters)||meters<0)throw Error('NO_ROUTE');
   knownMeters+=meters;legs[i]={...legs[i],status:'calculated',km:Math.round(meters/10)/100,reason:null,estimated:!!(a.approximate||b.approximate),source:'OSRM road network (demo)'};
  }catch(error){if(signal?.aborted)throw error;legs[i].reason='ROUTER_UNAVAILABLE'}
 }
 const complete=legs.every(x=>x.status==='calculated');
 return {status:complete?'complete':'partial',estimated:legs.some(x=>x.estimated),totalKm:complete?Math.round(knownMeters/10)/100:null,knownKm:Math.round(knownMeters/10)/100,legs,source:'OSRM road network (demo)',calculatedAt:new Date().toISOString()};
}
