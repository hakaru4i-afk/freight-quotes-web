// Staging-only route distances. OSRM public demo is NOT a production SLA.
// Distances are measured on the road network; no straight-line substitute.
const ROUTER='https://router.project-osrm.org';
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);
const geoKm=(a,b)=>{const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lng-a.lng)*r;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
};
export async function calculateMapDistances(route,{signal,fetchImpl=fetch}={}){
 const stops=route.stops||[],mode=route.mode;
 const legs=stops.slice(1).map((to,i)=>({from:stops[i].label,to:to.label,status:'unavailable',km:null,reason:'ROUTE_UNAVAILABLE'}));
 // Every shipment with two located endpoints gets an initial numeric geographical lower bound.
 // It is not a road, rail, sea or air route, and must never trigger the <1000 km VED rule.
 const allLocated=stops.length>=2&&stops.every(s=>valid(s.position));
 const minimumKm=allLocated?Math.round(stops.slice(1).reduce((sum,stop,i)=>sum+geoKm(stops[i].position,stop.position),0)*10)/10:null;
 const provisional=(reason)=>({status:minimumKm===null?'unavailable':'provisional',totalKm:minimumKm,
   knownKm:0,estimated:true,geodesicMinimum:minimumKm!==null,source:'Geographical lower bound, not a transport route',
   legs:legs.map((x,i)=>({...x,km:allLocated?Math.round(geoKm(stops[i].position,stops[i+1].position)*10)/10:null,estimated:true,reason})),
   calculatedAt:new Date().toISOString()});
 // No carrier yet: try a provisional road-network route. Other modes never use an automobile router.
 if(mode!=='road'&&mode!=='unknown')return provisional(mode==='multi'?'LEG_MODES_REQUIRED':'NETWORK_ROUTER_REQUIRED');
 let knownMeters=0;
 for(let i=0;i<legs.length;i++){
  const a=stops[i].position,b=stops[i+1].position;
  if(!valid(a)||!valid(b)){legs[i].reason='COORDINATES_MISSING';continue}
  if(a.queryScope!=='public-place-only'||b.queryScope!=='public-place-only'){legs[i].reason='PRIVATE_ROUTER_REQUIRED';continue}
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
 if(!complete&&minimumKm!==null)return provisional(legs.some(leg=>leg.reason==='PRIVATE_ROUTER_REQUIRED')?'PRIVATE_ROUTER_REQUIRED':'ROAD_NETWORK_UNAVAILABLE');
 return {status:complete?mode==='unknown'?'provisional':'complete':'partial',
   estimated:mode==='unknown'||legs.some(x=>x.estimated),
   provisionalMode:mode==='unknown',geodesicMinimum:false,
   totalKm:complete?Math.round(knownMeters/10)/100:null,knownKm:Math.round(knownMeters/10)/100,
   legs,source:'OSRM road network (demo)',calculatedAt:new Date().toISOString()};
}
