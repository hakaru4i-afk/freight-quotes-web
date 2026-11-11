import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
export async function cabinetMatrix({page,actor,rec}){
 const failures=[];rec.cabinetMatrix=[];
 for(const [lang,label]of [['ru','Русский'],['en','English'],['zh','中文']]){
  try{
   await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:label,exact:true}).first().click();
   await page.waitForFunction(l=>document.documentElement.lang.startsWith(l),lang);
   const link=page.locator('.cabinet-sidebar nav a[href="#help"]').first();
   if(await link.count())await link.evaluate(el=>el.click());else await page.locator('.sw-sidebar nav button').last().click();
   await page.locator('#alignment-role-guidance').waitFor({timeout:30000});
   for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(250);
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,role:document.querySelector('[data-cabinet-role]')?.dataset.cabinetRole}));
    if(layout.scroll>viewport.width+4)failures.push({lang,width:viewport.width,error:'HORIZONTAL_OVERFLOW',layout});
    await page.addScriptTag({path:process.env.AXE_CORE_PATH||'/tmp/freight-axe/node_modules/axe-core/axe.min.js'});
    const axe=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return{passes:r.passes.length,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,12)}))};});
    const screenshot='reports/isolated-rc/'+actor+'-matrix-'+lang+'-'+viewport.width+'.png';await page.screenshot({path:screenshot,fullPage:false});
    rec.cabinetMatrix.push({lang,...viewport,...layout,axe,screenshot,screenshotSha256:createHash('sha256').update(await readFile(screenshot)).digest('hex')});
    if(axe.violations.length)failures.push({lang,width:viewport.width,violations:axe.violations});
   }
  }catch(e){failures.push({lang,error:e.message});}
 }
 rec.cabinetMatrixFailures=failures;assert.deepEqual(failures,[],'Actual cabinet locale/accessibility matrix failed');
}
