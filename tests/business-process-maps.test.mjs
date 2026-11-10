import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {outputs,validate,assertSourcesCurrent} from '../scripts/build-process-maps.mjs';
import {chromium} from 'playwright';
const model=JSON.parse(readFileSync('test/business-process-model.json','utf8'));
test('all ten processes have independent technical and logic assessments and current artifacts',()=>{
 validate(model);assertSourcesCurrent(model);assert.throws(()=>assertSourcesCurrent({...model,reviewedSourceSignatures:{}}),/without reviewed map/);assert.equal(model.processes.length,10);
 for(const [path,content] of outputs(model))assert.equal(readFileSync(path,'utf8'),content,path+' is stale; regenerate from reviewed model');
 assert.equal(model.processes.find(p=>p.id==='P05').logicStatus,'LOGIC_PROBLEM');
 assert.equal(model.processes.find(p=>p.id==='P07').logicStatus,'BLOCKED');
 assert.ok(model.processes.every(p=>p.technicalStatus==='PARTIAL'),'Do not turn source review into full acceptance');
});
test('agreed VED review and role limits survive map generation; proposals are not executable stages',()=>{
 const ved=model.processes.find(p=>p.id==='P06');assert.match(ved.agreed,/одна|Одна/);assert.match(ved.agreed,/до ПТО/);
 assert.ok(ved.nodes.some(n=>n.role==='logistic'));
 assert.ok(!model.processes.flatMap(p=>p.nodes).some(n=>/согласовать.*транспортную заявку|новый акт/i.test(n.title)));
 const other=model.processes.find(p=>p.id==='P08');assert.ok(other.nodes.every(n=>n.role==='system'||n.status==='read-only'));
 assert.match(model.decisions.join(' '),/09\.11/);
 assert.throws(()=>validate({...model,processes:[...model.processes,model.processes[0]]}),/Duplicate/);
});
test('process page parses SVG/drawio, filters cabinets, and stays usable at 390px',async()=>{
 const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const path=resolve('test','.'+url.pathname);if(!path.startsWith(resolve('test')+'/')){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',extname(path)==='.html'?'text/html; charset=utf-8':extname(path)==='.svg'?'image/svg+xml':'text/plain');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const browser=await chromium.launch();
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/process-map.html');
  const xml=[...outputs(model)].filter(([name])=>/\.(svg|drawio)$/.test(name)).map(([name,content])=>({name,content}));
  assert.deepEqual(await page.evaluate(items=>items.filter(x=>new DOMParser().parseFromString(x.content,'application/xml').querySelector('parsererror')).map(x=>x.name),xml),[]);
  await page.getByLabel('Кабинет').selectOption('logistic');assert.equal(await page.locator('section:visible').count(),1);
  assert.match(await page.locator('section:visible').innerText(),/P06/);assert.equal(await page.locator('nav li:visible').count(),1);
  await page.locator('section:visible summary').click();
  await mkdir('reports/business-logic',{recursive:true});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'reports/business-logic/process-map-'+viewport.width+'.png',fullPage:true});}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(done=>server.close(done));}
},{timeout:45000});
