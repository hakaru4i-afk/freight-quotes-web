import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRemainingClient, sha256} from './carrier124-remaining-api.mjs';

const modes=[
  ['road','QA-N26-ROAD-POINTS'],
  ['rail','QA-N26-RAIL-1'],
  ['sea','QA-CI-18E8AAF6-SEA-3804B84D'],
  ['air','QA-CI-18E8AAF6-AIR-289CC1EF'],
  ['multi','QA-CI-18E8AAF6-MULTI-95CAED84']
];
const viewportSizes=[{width:1440,height:900},{width:390,height:844}];
const locales=[['ru','Русский','Изменения и инструкции'],['en','English','Changes and instructions'],['zh','中文','变更与说明']];

export async function remainingDisplay({page,actor,sessions,rec,report,evidenceDir,phase}, openCabinet) {
  const api=await createRemainingClient(sessions,report.calls);
  if(phase==='locales'){
    const profile=await api(actor,'/api/session');
    assert.equal(profile.json.authenticated,true);
    const entries=[];
    rec.remaining={role:profile.json.role,entries};
    for(const [lang,label,heading] of locales){
      await page.setViewportSize(viewportSizes[0]);
      try {
        await page.getByRole('button',{name:label,exact:true}).first().click({timeout:12000});
        await page.waitForFunction(lang=>document.documentElement.lang.startsWith(lang),lang,{timeout:12000});
        const help=page.locator('.cabinet-sidebar nav a[href="#help"]');
        if(await help.count())await openCabinet(page,'help');
        else{
          const faq=page.locator('.sw-sidebar nav button').filter({hasText:/FAQ|帮助|说明|Инструкц/i}).first();
          await faq.click({timeout:12000});
        }
        const guidance=page.locator('#alignment-role-guidance');
        await guidance.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:12000});
        assert.ok(await guidance.locator('p').count()>0);
        for(const viewport of viewportSizes){
          await page.setViewportSize(viewport);
          await guidance.waitFor({state:'visible'});
          const metrics=await page.evaluate(()=>({width:innerWidth,contentWidth:document.documentElement.scrollWidth}));
          assert.ok(metrics.contentWidth<=metrics.width+4,'Horizontal overflow');
          const file=join(evidenceDir,actor+'-'+lang+'-'+viewport.width+'-faq.png');
          await page.screenshot({path:file,animations:'disabled'});
          entries.push({lang,viewport,heading,guidance:true,sha256:sha256(await readFile(file))});
        }
      }catch(error){
        entries.push({lang,error:String(error.message).slice(0,550)});
      }
    }
  }else{
    assert.equal(actor,'carrierA');
    await openCabinet(page,'approved-shipments');
    const entries=[];
    rec.remaining={entries};
    const selectedModes=process.env.QA_CARRIER124_MAP_MODES?.split(',');
    if(selectedModes)assert.ok(selectedModes.every(mode=>modes.some(([available])=>available===mode)));
    for(const [mode,order] of modes.filter(([name])=>!selectedModes||selectedModes.includes(name))){
      try{
        const detail=await api(actor,'/api/task2',{order});
        const data=detail.json;
        const target=data.state.status==='completed'?'archive':'active';
        const filter=page.locator('[data-t2-filter="'+target+'"]');
        if(await filter.count())await filter.click({timeout:10000});
        await page.locator('#t2-select').selectOption(order,{timeout:14000});
        await page.waitForFunction(({order,mode})=>document.querySelector('#t2-select')?.value===order
          &&document.querySelector('#task2-root global-route-view')?.routeSnapshot?.mode===mode,{order,mode},{timeout:14000});
        const map=page.locator('#task2-root global-route-view');
        const captures=[];
        for(const viewport of viewportSizes){
          await page.setViewportSize(viewport);
          for(const view of ['3d','2d']){
            await map.getByRole('button',{name:view==='3d'?'3D-глобус':'2D-карта',exact:true}).click({timeout:10000});
            const snapshotHandle=await page.waitForFunction(({mode,view})=>{
              const element=document.querySelector('#task2-root global-route-view');
              return element?.dataset.mode===view&&element.routeSnapshot?.mode===mode&&element.routeSnapshot;
            },{mode,view},{timeout:10000});
            const snapshot=await snapshotHandle.jsonValue();
            await snapshotHandle.dispose();
            assert.equal(snapshot.mode,mode);
            assert.ok(snapshot.stops.length>=2);
            for(const point of data.points){
              const marker=snapshot.markers.find(m=>m.pointId===point.id);
              if(marker){
                assert.equal(point.geocode?.status,'resolved');
                assert.equal(marker.lat,point.geocode.lat);
                assert.equal(marker.lng,point.geocode.lon);
              }
            }
            const file=join(evidenceDir,mode+'-'+view+'-'+viewport.width+'.png');
            await map.screenshot({path:file,animations:'disabled',timeout:15000});
            captures.push({viewport,view,stops:snapshot.stops.length,tracking:snapshot.markers.filter(m=>m.tracking).length,sha256:sha256(await readFile(file))});
          }
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));
        }
        entries.push({mode,order,api:detail.requestId,captures});
      }catch(error){
        entries.push({mode,order,error:String(error.message).slice(0,550)});
      }
    }
  }
}
