import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
export async function cabinetMatrix({page,actor,rec}){
 const failures=[];rec.cabinetMatrix=[];await page.route('**/qa-axe.min.js',route=>route.fulfill({path:process.env.AXE_CORE_PATH||'/tmp/freight-axe/node_modules/axe-core/axe.min.js',contentType:'text/javascript'}));
 const sizes=[{width:1366,height:768},{width:390,height:844}],languages=[['ru','Русский'],['en','English'],['zh','中文']];
 async function language(lang,label){await page.setViewportSize(sizes[0]);await page.getByRole('button',{name:label,exact:true}).first().click();await page.waitForFunction(l=>document.documentElement.lang.startsWith(l),lang);await page.locator('.cabinet-sidebar nav a[href="#help"],.sw-sidebar nav button').first().waitFor({state:'attached',timeout:30000});}
 async function capture(lang,viewport,screen='help'){
  await page.setViewportSize(viewport);await page.waitForTimeout(900);
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,role:document.querySelector('[data-cabinet-role]')?.dataset.cabinetRole}));
  if(layout.scroll>viewport.width+4)failures.push({lang,screen,width:viewport.width,error:'HORIZONTAL_OVERFLOW',layout});
  await page.addScriptTag({url:new URL('./qa-axe.min.js',page.url()).href});
  rec.surfaceDiagnostics??=await page.evaluate(()=>[...document.querySelectorAll('h3')].filter(e=>e.getClientRects().length).slice(0,18).map(e=>({text:e.textContent.slice(0,70),parents:[e,e.parentElement,e.parentElement?.parentElement].filter(Boolean).map(n=>({tag:n.tagName,cls:n.className,bg:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color,fill:getComputedStyle(n).webkitTextFillColor,opacity:getComputedStyle(n).opacity}))})));
  const axe=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return{passes:r.passes.length,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,12)}))};});
  const screenshot='reports/isolated-rc/'+actor+'-matrix-'+lang+'-'+viewport.width+(screen==='help'?'':'-'+screen)+'.png';await page.screenshot({path:screenshot,fullPage:false});
  rec.cabinetMatrix.push({lang,screen,...viewport,...layout,axe,screenshot,screenshotSha256:createHash('sha256').update(await readFile(screenshot)).digest('hex')});
  if(axe.violations.length)failures.push({lang,screen,width:viewport.width,violations:axe.violations});
 }
 for(const [lang,label]of languages){try{
  await language(lang,label);const link=page.locator('.cabinet-sidebar nav a[href="#help"]').first();if(await link.count())await link.evaluate(el=>el.click());else await page.locator('.sw-sidebar nav button').last().click();await page.locator('#alignment-role-guidance').waitFor({timeout:30000});for(const size of sizes)await capture(lang,size);
 }catch(e){failures.push({lang,screen:'help',error:e.message});}}
 if(actor==='owner')for(const [lang,label]of languages)for(const screen of ['updates','remarks','developments','cooperation','process']){try{
  await language(lang,label);await page.locator('[data-ow-register="'+screen+'"]').click();
  if(['updates','remarks','developments'].includes(screen)){
   await page.waitForFunction(()=>[...document.querySelectorAll('#ow-workspace .ow-work-card[data-record-id]')].some(card=>card.getClientRects().length&&card.dataset.recordId&&card.textContent.trim()),{},{timeout:45000});
  }else if(screen==='process')await page.locator('#ow-process-editor [data-editor-node]').first().waitFor({timeout:30000});else await page.locator('#ow-cooperation-screen .lw-owner-head').waitFor({timeout:30000});
  for(const size of sizes)await capture(lang,size,screen);
 }catch(e){failures.push({lang,screen,error:e.message});}}
 rec.cabinetMatrixFailures=failures;assert.deepEqual(failures,[],'Actual cabinet locale/accessibility matrix failed');
}
