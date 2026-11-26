import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

// Use the exact two scripts shipped together by the current three-register UI.
const js=readFileSync('test/owner-registers-20261111.js');
const actions=readFileSync('test/owner-register-task-actions-20261121.js');
const css=readFileSync('test/owner-registers-20261111.css');
const record={
 id:'ISSUE-web-60',sourceTaskKey:'github:freight-quotes-web:60',
 register:'remarks',title:'Перевозка не появляется у ВЭД после принятия',
 area:'Исполнение перевозок',roles:['carrier','logistic'],
 description:'Перевозчик принял перевозку, но ВЭД не видит её в списке активных.',
 expected:'Показывать принятую перевозку ВЭД автоматически.',
 impact:'ВЭД не может вовремя проверить документы.',reason:'Не задерживать оформление.',
 priority:'P0',status:'awaiting_decision',detectedAt:'2026-11-14T12:00:00Z',
 version:'SH-01.30.52 v',responsible:'Codex',
 verification:'Проверка рабочего выпуска ещё не выполнена.',
 technical:{issue:'https://github.com/hakaru4i-afk/freight-quotes-web/issues/60',cause:'Technical hidden cause'}
};
const pageHtml='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style"><div id="root"><div class="cabinet-app" data-cabinet-role="owner"><aside class="cabinet-sidebar"><nav></nav></aside><main class="cabinet-content"></main></div></div><script src="/actions"></script><script src="/script"></script></html>';

test('Owner transfers one readable task to the Improvement Center without duplicate register work; mobile390',async t=>{
 const items=[{id:'untrusted',sender_role:'carrier',status:'in_progress',description:'Untrusted feedback [WORK:github:freight-quotes-web:60]'}];
 const writes=[],events=[],executions=[];
 const send=(res,data)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(data));};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/script'){res.setHeader('content-type','text/javascript');res.end(js);return;}
  if(url.pathname==='/actions'){res.setHeader('content-type','text/javascript');res.end(actions);return;}
  if(url.pathname==='/style'){res.setHeader('content-type','text/css');res.end(css);return;}
  if(url.pathname==='/api/engineering-registers'){
   const name=url.searchParams.get('name'),markdown='Private original technical history';
   send(res,{ok:true,name,markdown,sha256:createHash('sha256').update(markdown).digest('hex'),records:name==='remarks'?[record]:[],entries:[]});
   return;
  }
  if(url.pathname==='/api/portal-feedback'){
   if(req.method==='GET'){send(res,{ok:true,owner:true,items,events,hasMore:false});return;}
   send(res,{ok:false,error:'Feedback status must not be changed by register transfer'});return;
  }
  if(url.pathname==='/api/owner-register-execution'){
   if(req.method==='GET'){send(res,{ok:true,items:executions});return;}
   let raw='';for await(const chunk of req)raw+=chunk;
   const body=JSON.parse(raw);
   assert.deepEqual(body,{action:'transfer',register:'remarks',recordId:record.id});
   writes.push(body);
   if(!executions.length){
    executions.push({register:'remarks',recordId:record.id,decision:'in_progress',feedbackId:'work-one',progress:10});
    items.push({id:'work-one',sender_role:'owner',code:'IM-2026-000001',status:'in_progress',description:record.title+'\n[WORK:'+record.sourceTaskKey+']'});
    events.push({request_id:'work-one',description:'Владелец взял задачу в работу',actor_login:'test-owner',created_at:'2026-11-14T13:00:00Z'});
   }
   send(res,{ok:true,transferred:true,feedbackId:'work-one'});return;
  }
  res.setHeader('content-type','text/html');res.end(pageHtml);
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true});
 t.after(async()=>{await browser.close();await new Promise(ok=>server.close(ok));});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?ownerView=remarks');
 const card=page.locator('.ow-work-card');await card.waitFor({timeout:12000});
 assert.match(await card.innerText(),/Перевозка не появляется у ВЭД/);
 assert.doesNotMatch(await card.innerText(),/Technical hidden cause/);
 await page.getByText('Фильтры',{exact:true}).click();
 const toolbar=page.locator('.ow-stable-toolbar button'),before=await toolbar.boundingBox();
 await page.locator('[data-archive-filter="priority"]').selectOption('P3');
 assert.equal(await card.count(),0);
 assert.deepEqual(await toolbar.boundingBox(),before);
 await page.locator('[data-archive-filter="priority"]').selectOption('P0');
 await card.getByRole('button',{name:'Взять в работу',exact:true}).click();
 // The All view retains the source record for audit, but no longer offers a duplicate transfer.
 await page.waitForFunction(()=>document.querySelector('.ow-register-count')?.textContent==='Незавершённых записей: 0',null,{timeout:12000});
 assert.equal(await card.count(),1,'One source record remains for audit');
 await card.getByRole('link',{name:'Задача перенесена в Центр доработок — открыть',exact:true}).waitFor();
 assert.equal(await card.getByRole('button',{name:'Взять в работу',exact:true}).count(),0);
 await page.locator('[data-register-view="new"]').click();
 assert.equal(await card.count(),0,'Transferred task must leave new intake');
 assert.deepEqual(writes,[{action:'transfer',register:'remarks',recordId:record.id}]);
 assert.equal(items.filter(x=>x.sender_role==='owner').length,1,'One Owner task only');
 assert.equal(events.length,1,'One auditable transfer event only');
 await page.reload();
 await page.locator('.ow-register-count').waitFor({timeout:12000});
 await page.waitForFunction(()=>document.querySelector('.ow-register-count')?.textContent==='Незавершённых записей: 0',null,{timeout:12000});
 assert.equal(await card.count(),1,'One auditable source record remains after reload');
 await card.getByRole('link',{name:'Задача перенесена в Центр доработок — открыть',exact:true}).waitFor();
 assert.equal(await card.getByRole('button',{name:'Взять в работу',exact:true}).count(),0);
 await page.locator('[data-register-view="new"]').click();
 assert.equal(await card.count(),0,'Transferred task must not duplicate in intake after reload');
 assert.equal(writes.length,1,'Reload and filtering must not repeat transfer');
 assert.equal(items.filter(x=>x.sender_role==='owner').length,1,'Exactly one Owner task after reload');
 assert.equal(events.length,1,'Exactly one audit event after reload');
 assert.equal(items.find(x=>x.id==='untrusted').status,'in_progress','Other authors are unchanged');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await page.screenshot({path:'/tmp/owner-register-release-mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'No browser runtime exceptions');
});
