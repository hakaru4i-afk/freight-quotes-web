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
  if(phase==='weekly'){
    assert.equal(actor,'carrierA');
    const order=modes.find(([mode])=>mode==='air')[1];
    const detail=await api(actor,'/api/task2',{order});
    assert.ok(detail.json.state.actual_departure,'Fixture must have an actual departure');
    await openCabinet(page,'approved-shipments');
    await page.locator('#t2-select').selectOption(order);
    const entries=[];
    const weekly=page.locator('[data-t2-weekly-summary]');
    let expectedInstant;
    for(const [lang,option,label] of [
      ['ru','Русский','Следующий срок'],['en','English','Next deadline'],['zh','中文','下次截止时间']
    ]){
      await page.setViewportSize(viewportSizes[0]);
      await page.getByRole('button',{name:option,exact:true}).first().click();
      await page.waitForFunction(lang=>document.documentElement.lang.startsWith(lang),lang);
      await weekly.getByText(label,{exact:true}).waitFor({timeout:12000});
      const time=weekly.locator('time[data-t2-deadline]');
      const instant=await time.getAttribute('datetime');
      assert.ok(Number.isFinite(Date.parse(instant)));
      expectedInstant??=instant;
      assert.equal(instant,expectedInstant);
      const expected=new Intl.DateTimeFormat({ru:'ru-RU',en:'en-GB',zh:'zh-CN'}[lang],{
        timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
      }).format(new Date(instant));
      for(const viewport of viewportSizes){
        await page.setViewportSize(viewport);
        assert.equal(await time.innerText(),expected);
        await weekly.getByText(label,{exact:true}).waitFor({state:'visible'});
        entries.push({lang,viewport,label,instant,displayed:expected});
      }
    }
    rec.remaining={order,requestId:detail.requestId,entries};
    return;
  }
  if(phase==='menus'){
    const profile=(await api(actor,'/api/session')).json;
    assert.equal(profile.authenticated,true);
    const selector='.cabinet-sidebar nav a[href^="#"],.sw-sidebar nav button';
    const entries=[];
    rec.remaining={role:profile.role,entries};
    for(const [lang,label] of locales){
      await page.setViewportSize(viewportSizes[0]);
      await page.getByRole('button',{name:label,exact:true}).first().click();
      await page.waitForFunction(lang=>document.documentElement.lang.startsWith(lang),lang);
      await page.locator(selector).first().waitFor({state:'attached'});
      const desktop=await page.locator(selector).evaluateAll(links=>links.map((el,i)=>({
        key:el.getAttribute('href')||'button-'+i,
        label:(el.innerText||el.getAttribute('aria-label')||'').trim(),
        visible:el.getClientRects().length>0
      })).filter(el=>el.visible));
      assert.ok(desktop.length>0,'No visible menu');
      assert.ok(desktop.every(item=>item.label),'An active menu item has no label');
      const navigation=[];
      for(const item of desktop){
        if(!/^#[a-z0-9-]+$/.test(item.key))continue;
        try{
          const mount={'#portal-feedback':'#portal-feedback-root','#chats':'#lw-ved-chat-page'}[item.key];
          if(mount){
            await page.locator('.cabinet-sidebar nav a[href="'+item.key+'"]').first().evaluate(el=>el.click());
            await page.locator(mount).waitFor({state:'visible',timeout:8000});
          }else{
            await openCabinet(page,item.key.slice(1));
          }
          navigation.push({key:item.key,opened:true});
        }catch(error){
          navigation.push({key:item.key,opened:false,reason:String(error.message).slice(0,250)});
        }
      }
      await page.setViewportSize(viewportSizes[1]);
      const toggle=page.locator('.cabinet-menu-toggle');
      if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
      const mobileCount=await page.locator(selector).evaluateAll(links=>links.filter(el=>el.getClientRects().length>0).length);
      assert.ok(mobileCount>0,'No mobile menu items after opening the menu');
      if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));
      entries.push({lang,desktop,navigation,mobileCount});
    }
    return;
  }
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
        if(await filter.isVisible()&&await filter.getAttribute('aria-pressed')!=='true')
          await filter.click({timeout:10000});
        await page.locator('#t2-select').selectOption(order,{timeout:14000});
        await page.waitForFunction(({order,mode})=>document.querySelector('#t2-select')?.value===order
          &&document.querySelector('#task2-root global-route-view')?.routeSnapshot?.mode===mode,{order,mode},{timeout:14000});
        const map=page.locator('#task2-root global-route-view');
        const captures=[];
        for(const viewport of viewportSizes){
          await page.setViewportSize(viewport);
          for(const view of ['3d','2d']){
            // A refreshed tracking panel can remount the map while preserving its mode.
            // Do not click a selected mode: still verify the mounted route snapshot below.
            const modeButton=map.getByRole('button',{name:view==='3d'?'3D-глобус':'2D-карта',exact:true});
            await modeButton.waitFor({state:'visible',timeout:10000});
            if(await map.getAttribute('data-mode')!==view)
              await modeButton.click({timeout:10000});
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
        for(const [lang,label,controls] of [
          ['en','English',['3D globe','2D map','Shipment distance']],
          ['zh','中文',['3D 地球','2D 地图','运输距离']]
        ]){
          await page.getByRole('button',{name:label,exact:true}).first().click({timeout:12000});
          await page.waitForFunction(lang=>document.documentElement.lang.startsWith(lang),lang);
          const globeButton=map.getByRole('button',{name:controls[0],exact:true});
          const flatButton=map.getByRole('button',{name:controls[1],exact:true});
          await globeButton.waitFor({state:'visible',timeout:10000});
          if(await map.getAttribute('data-mode')!=='3d')await globeButton.click({timeout:10000});
          await page.waitForFunction(()=>document.querySelector('#task2-root global-route-view')?.dataset.mode==='3d');
          await flatButton.waitFor({state:'visible',timeout:10000});
          if(await map.getAttribute('data-mode')!=='2d')await flatButton.click({timeout:10000});
          await map.getByRole('heading',{name:controls[2],exact:true}).waitFor();
          await page.waitForFunction(()=>document.querySelector('#task2-root global-route-view')?.dataset.mode==='2d');
          captures.push({locale:lang,view:'2d',localizedControls:true});
        }
        entries.push({mode,order,api:detail.requestId,captures});
      }catch(error){
        entries.push({mode,order,error:String(error.message).slice(0,550)});
      }
    }
    assert.ok(entries.length&&entries.every(entry=>!entry.error),'A map mode did not finish');
  }
}
