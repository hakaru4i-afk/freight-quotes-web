import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{createHash,randomUUID}from'node:crypto';
export async function map50Scenario({page,actor,base,sessions,rec,report,evidenceDir}){
 const owner=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0],order=owner.createdOrder,winner=owner.selection.winnerActor;rec.mapOrder=order;
 async function api(who,path,body){const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io','Content-Type':'application/json',...(who?{Authorization:'Bearer '+sessions[who]}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});return{status:r.status,data:await r.json(),requestId:r.headers.get('x-freight-request-id')};}
 function assertValidProviderPoint(point){
  assert.equal(point.provider,'local-gazetteer');
  assert.equal(point.status,'resolved');
  assert.ok(point.candidateId&&Number.isFinite(Date.parse(point.geocodedAt)));
  assert.ok(Number.isFinite(point.lat)&&Number.isFinite(point.lon));
  // A mapped OSM port area is a useful *approximate* 2D/3D marker, but is
  // not a verified berth and must never count as an exact AUTO-KM facility.
  const approximatePort=point.precision==='approximate'&&point.objectType==='sea_port'&&
    /^osm:way:\d+$/.test(point.candidateId)&&point.confirmed===false;
  assert.ok(['city','facility'].includes(point.precision)||approximatePort,
    'Only verified facility/city or clearly unverified OSM port area may be drawn');
  if(point.precision==='city'||point.precision==='approximate')assert.equal(point.confirmed,false);
 }
 const detail=async who=>api(who,'/api/task2?order='+encodeURIComponent(order));let d=(await detail(actor)).data;
 const waitForShipment=()=>page.waitForFunction(expected=>{
  const view=document.querySelector('global-route-view[data-route]');
  return view&&JSON.parse(view.getAttribute('data-route'))[0]?.orderCode===expected;
 },order,{timeout:60000});
 await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});await waitForShipment();const map=page.locator('global-route-view').first();await map.waitFor({state:'visible',timeout:60000});
 if(actor==='owner'){
  // Offline catalog entries cannot be fixed by retrying a paid/remote provider.
  // Preserve actual coverage failures instead of masking them with retries.
  rec.ownerGeocodeRetries=[];
  d=(await detail(actor)).data;
  for(const p of d.plannedGeocodes.owner.filter(p=>p.status==='ambiguous')){
   const candidate=p.candidates.find(c=>['rail_station','rail_freight_station'].includes(c.objectType))||p.candidates[0];assert.ok(candidate);
   const form=page.locator('.gv-geocode-form[data-geo-id="'+p.id+'"]');await form.locator('..').locator('summary').click();await form.locator('[name="candidateId"]').selectOption(candidate.candidateId);await form.locator('[name="reason"]').fill('Synthetic confirmed station selection for MAP50');await form.locator('[name="confirmed"]').check();const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.candidateId===candidate.candidateId);await form.getByRole('button',{name:'Сохранить уточнение',exact:true}).click();assert.equal((await saved).status(),200);await page.waitForTimeout(500);
  }
  d=(await detail(actor)).data;
  // Keep diagnostics privacy-safe: no raw addresses, candidate labels, or tokens.
  // A successful HTTP 200 does not imply that the local catalog resolved the point.
  const unresolved=d.plannedGeocodes.owner.filter(p=>p.status!=='resolved'||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)).map(p=>({
   id:p.id,status:['unavailable','ambiguous','not_found','pending','resolved','error'].includes(p.status)?p.status:'other',reason:/^(NOT_IN_LOCAL_CATALOG|LOCAL_CATALOG_NOT_READY|LOCAL_CATALOG_QUERY_ERROR|LOCAL_CATALOG_INVALID_RESPONSE|COUNTRY_MISMATCH|PLACE_REQUIRED|INVALID_PUBLIC_TOPONYM|FACILITY_NAME_REQUIRED|NOT_FOUND|AMBIGUOUS)$/.test(String(p.reason||''))?p.reason:'REDACTED',
   geocodedAt:p.geocodedAt||null,
   candidateCount:Array.isArray(p.candidates)?p.candidates.length:0,
   hasFiniteCoordinates:Number.isFinite(p.lat)&&Number.isFinite(p.lon)
  }));
  rec.ownerGeocodeReadback={total:d.plannedGeocodes.owner.length,unresolved,retries:rec.ownerGeocodeRetries};
  await writeFile(evidenceDir+'/map50-owner-geocode-readback.json',JSON.stringify(rec.ownerGeocodeReadback,null,2));
  // Emit only allowlisted machine-readable status codes to CI logs. Private
  // reason text may contain an address or URL and stays in the private artifact.
  if(unresolved.length){
   const safeStatuses=new Set(['unavailable','ambiguous','not_found','pending','resolved','error']);
   const summary=unresolved.map(p=>({status:safeStatuses.has(p.status)?p.status:'other',
    catalogMissing:p.reason==='NOT_IN_LOCAL_CATALOG',
    catalogError:/^LOCAL_CATALOG_/.test(String(p.reason||'')),
    hasFiniteCoordinates:p.hasFiniteCoordinates,candidateCount:p.candidateCount}));
   console.error('MAP50_LOCAL_CATALOG_UNRESOLVED_SAFE_SUMMARY '+JSON.stringify({total:d.plannedGeocodes.owner.length,unresolved:summary}));
  }
  assert.deepEqual(unresolved,[],'MAP50 offline catalog incomplete or ambiguous; see map50-owner-geocode-readback.json');
  assert.ok(d.plannedGeocodes.owner.length>=2);
  for(const point of d.plannedGeocodes.owner)assertValidProviderPoint(point);
  const p=d.plannedGeocodes.owner[0],before=p.original_text;
  for(const[body,status]of [[{queryText:'Беларусь, Шэньчжэнь',reason:'Synthetic country conflict for MAP50',confirmed:true},'not_found'],[{},'resolved']]){const r=await api('owner','/api/task2',{action:'geocode_retry',order,pointId:p.id,...body});assert.equal(r.status,200);assert.equal(r.data.result.status,status);}
  const checked=(await detail('owner')).data.plannedGeocodes.owner.find(q=>q.id===p.id);assert.equal(checked.original_text,before);
  rec.ownerGeocodes={count:d.plannedGeocodes.owner.length,allResolved:true,wrongCountryRejected:true,originalPreserved:true};
  // A separate short, public route exercises the real road network even if
  // the shipment crosses a border without a routable international connection.
  const direct=['Беларусь, Минск','Беларусь, Брест'];
  const via=[direct[0],'Беларусь, Могилёв',direct[1]];
  const distance=async (addresses,transport='Авто')=>api('owner','/api/route-distance',{addresses,transport});
  const first=await distance(direct),changed=await distance(via);
  for(const [result,pointCount] of [[first,2],[changed,3]]){
   assert.equal(result.status,200,JSON.stringify(result));
   const {km,points,source,estimated}=result.data;
   assert.ok(Number.isFinite(km)&&km>0);
   assert.equal(source,'OSRM / OpenStreetMap');
   assert.equal(estimated,true,'City centroids do not verify an exact road distance');
   assert.equal(points.length,pointCount);
   for(const point of points)assertValidProviderPoint(point);
  }
  assert.notEqual(first.data.key,changed.data.key);
  assert.ok(changed.data.km>first.data.km);
  for(const mode of ['ЖД','Море','Авиа'])assert.equal((await distance(via,mode)).status,422);
  rec.roadDistance={direct:{km:first.data.km,requestId:first.requestId},via:{km:changed.data.km,requestId:changed.requestId},cityEstimated:true,nonRoadDenied:true};
  return;
 }
 if(actor==='ved'){assert.equal(await map.locator('.gv-geocode-form').count(),0);await page.waitForFunction(()=>document.querySelector('global-route-view')?.routeSnapshot?.markers?.filter(p=>p.tracking).length===2);rec.map50ReadOnly={result:'PASS',points:d.points.length,mutationsAllowed:false};return;}
 assert.equal(actor,winner);if(!d.state.actual_departure){const form=page.locator('[data-t2-form="actual"]');await form.locator('[name="actual_departure"]').fill('2026-11-02T06:00');const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.order===order&&r.request().postDataJSON()?.fields?.actual_departure,{timeout:60000});await form.getByRole('button',{name:'Сохранить',exact:true}).click();assert.equal((await saved).status(),200);await page.locator('.t2-actual-saved').waitFor({timeout:60000});await waitForShipment();}
 const entries=[['Китай, Нинбо','2026-11-06T06:00'],['Беларусь, Брест','2026-11-13T06:00']];
 for(const[index,[where,date]]of entries.entries()){
  await waitForShipment();
  d=(await detail(actor)).data;if(d.points.length>index){assert.equal(d.points[index].location_text,where);const ids=d.points.map(p=>p.id);const replay=await api(actor,'/api/task2',{action:'save',order,fields:{location:where,location_date:d.points[index].observed_at}});assert.equal(replay.status,200);assert.deepEqual((await detail(actor)).data.points.map(p=>p.id),ids);continue;}
  const form=page.locator('[data-t2-form="weekly-point"]').first();await form.locator('[name="location"]').fill(where);await form.locator('[name="location_date"]').fill(date);
  const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.order===order&&r.request().postDataJSON()?.fields?.location===where,{timeout:60000});await form.getByRole('button',{name:'Сохранить',exact:true}).click();const response=await saved;assert.equal(response.status(),200);await page.waitForFunction(()=>document.querySelector('#task2-root')?.getAttribute('aria-busy')==='false');
  const first=(await detail(actor)).data.points;assert.equal(first.length,index+1);const retry=await api(actor,'/api/task2',response.request().postDataJSON());assert.equal(retry.status,200);const after=(await detail(actor)).data.points;assert.deepEqual(after.map(p=>p.id),first.map(p=>p.id),'Replay must preserve tracking identities');
 }
 const persisted=await detail(actor);d=persisted.data;assert.equal(d.points.length,2);
 rec.checkpointReadback={requestId:persisted.requestId,points:d.points.map(p=>({id:p.id,observedAt:p.observed_at,location:p.location_text,
  status:p.geocode?.status,reason:p.geocode?.reason,latitude:p.latitude,longitude:p.longitude}))};
 assert.ok(d.points.every(p=>p.geocode.status==='resolved'&&Number.isFinite(p.geocode.lat)&&Number.isFinite(p.geocode.lon)));assert.ok(d.plannedGeocodes.owner.every(p=>p.status==='resolved'));assert.ok(d.plannedGeocodes.offer.every(p=>p.status==='resolved'));assert.ok(d.plannedGeocodes.offer.some(p=>p.precision==='facility'));assert.ok(d.plannedGeocodes.offer.some(p=>p.original_text===(actor==='carrierA'?'Китай, Шанхай':'Китай, Нинбо')));assert.ok(!d.plannedGeocodes.offer.some(p=>p.original_text===(actor==='carrierA'?'Китай, Нинбо':'Китай, Шанхай')));
 for(const point of [...d.plannedGeocodes.owner,...d.plannedGeocodes.offer,...d.points.map(p=>p.geocode)])assertValidProviderPoint(point);

 for(const[who,body,expected]of [[actor,{action:'location',location:'',date:d.points[1].observed_at},400],['owner',{action:'location',location:'Беларусь, Брест',date:d.points[1].observed_at},403],['ved',{action:'location',location:'Беларусь, Брест',date:d.points[1].observed_at},403],[actor,{action:'geocode_retry',pointId:d.points[1].geocode.geoPointId,queryText:'China, Shenzhen',confirmed:false,reason:'Synthetic missing confirmation'},400]]){const r=await api(who,'/api/task2',{order,...body});assert.equal(r.status,expected);}
 const own=d.points[1].geocode.geoPointId,ownerPoint=d.plannedGeocodes.owner[0].id;
 for(const[who,body,expected]of [[actor,{pointId:ownerPoint},403],['ved',{pointId:own},403],[actor,{pointId:randomUUID()},403],[actor,{pointId:own,lat:0,lon:0},400]]){const r=await api(who,'/api/task2',{action:'geocode_retry',order,...body});assert.equal(r.status,expected);}
 for(const who of[actor==='carrierA'?'carrierB':'carrierA','supplier','supplierB',null])assert.ok([401,403,404].includes((await detail(who)).status));
 const snapshots=[];
 for(const size of[{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(size);for(const mode of['3d','2d']){await map.getByRole('button',{name:mode==='3d'?'3D-глобус':'2D-карта',exact:true}).click();await page.waitForFunction(({mode})=>document.querySelector('global-route-view')?.dataset.mode===mode,{mode});await map.locator(mode==='3d'?'.gv-stage-globe canvas':'.gv-stage-map.leaflet-container').waitFor({state:'visible',timeout:60000});await page.waitForTimeout(1000);const snapshot=await map.evaluate(el=>el.routeSnapshot);assert.ok(snapshot.stops.every(p=>p.position));assert.equal(snapshot.markers.filter(p=>p.tracking).length,2);assert.equal(snapshot.markers.find(p=>p.current).pointId,d.points[1].id);assert.equal(snapshot.markers.find(p=>p.current).observed_at,d.points[1].observed_at);assert.ok(await map.locator('.gv-distance').isVisible());assert.ok((await map.locator('.gv-current-caption').innerText()).includes(d.points[1].observed_at.slice(0,10)));assert.ok((await map.innerText()).includes('не GPS'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));snapshots.push(snapshot);const path=evidenceDir+'/map50-'+mode+'-'+size.width+'.png';await map.screenshot({path});(rec.mapScreenshots??=[]).push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),mode,...size});}}
 for(const s of snapshots)assert.deepEqual(s,snapshots[0]);
 let mutations=0;const count=req=>{if(req.method()==='POST'&&req.url().includes('/api/task2'))mutations++;};page.on('request',count);await page.reload({waitUntil:'domcontentloaded'});await page.getByText(/^(Выйти|Sign out|退出)$/).first().waitFor({timeout:60000});await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order);await waitForShipment();await page.waitForFunction(()=>document.querySelector('global-route-view')?.routeSnapshot?.markers?.filter(p=>p.tracking).length===2,{timeout:60000});assert.deepEqual(await page.locator('global-route-view').first().evaluate(el=>el.routeSnapshot),snapshots[0]);assert.equal(mutations,0);page.off('request',count);

 const identity=s=>({stops:s.stops.map(p=>({label:p.label,position:p.position})),tracking:s.markers.filter(p=>p.tracking).map(p=>({pointId:p.pointId,lat:p.lat,lng:p.lng,observed_at:p.observed_at}))});
 rec.mapLocales=[];
 await page.route('**/qa-axe.min.js',route=>route.fulfill({path:process.env.AXE_CORE_PATH||'/tmp/freight-axe/node_modules/axe-core/axe.min.js',contentType:'text/javascript'}));
 for(const[lang,label,prefix,modeName]of [['ru','Русский','Последнее местонахождение груза','2D-карта'],['en','English','Last reported cargo location','2D map'],['zh','中文','货物最后报告位置','2D 地图']]){
  await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:label,exact:true}).first().click();await page.waitForFunction(l=>document.documentElement.lang.startsWith(l),lang);await page.waitForFunction(p=>document.querySelector('global-route-view')?.routeSnapshot?.markers?.some(m=>m.current&&m.label.startsWith(p)),prefix);const currentMap=page.locator('global-route-view').first();await currentMap.getByRole('button',{name:modeName,exact:true}).click();await page.addScriptTag({url:new URL('./qa-axe.min.js',page.url()).href});
  for(const width of[1440,390]){await page.setViewportSize({width,height:width===390?844:900});await page.waitForTimeout(350);assert.deepEqual(identity(await currentMap.evaluate(el=>el.routeSnapshot)),identity(snapshots[0]));const axe=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('global-route-view'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return{passes:r.passes.length,violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}});if(lang==='en')assert.ok((await currentMap.locator('.gv-distance').innerText()).includes('Total distance:'));if(lang==='zh')assert.ok((await currentMap.locator('.gv-distance').innerText()).includes('总里程：'));rec.mapLocales.push({lang,width,axe});assert.equal(axe.violations.length,0,JSON.stringify(axe));const path=evidenceDir+'/map50-'+lang+'-'+width+'.png';await currentMap.screenshot({path});rec.mapScreenshots.push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),lang,width});}
 }
 rec.map50={result:'PASS',order,owner:d.plannedGeocodes.owner,offer:d.plannedGeocodes.offer,tracking:d.points.map(p=>({id:p.id,location_text:p.location_text,observed_at:p.observed_at,latitude:p.latitude,longitude:p.longitude,geocode:p.geocode})),route:snapshots[0],reloadPreserved:true,replayDeduplicated:true,negativeRoles:true,distancePanelVisible:true,mutationsAfterReload:0};await writeFile(evidenceDir+'/map50-server-readback.json',JSON.stringify(rec.map50,null,2)+'\n');
}
