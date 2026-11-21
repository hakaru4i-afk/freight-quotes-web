import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const repo='hakaru4i-afk/freight-quotes-web',sha='a'.repeat(40),branch='ci/sh59-verified-source-handoff-20261121';
const runNames=['SH59 immutable tested-source handoff (staging only)','Release stabilization candidate','Canonical staging alignment'];
const audit={id:44899669386,path:'.github/workflows/sh59-protected-37-audit.yml',head_repository:{full_name:repo},status:'completed',conclusion:'success'};
const pr={number:145,base:{ref:'main'},head:{ref:branch,sha,repo:{full_name:repo}}};
const runs=runNames.map((name,i)=>({id:i+1,name,head_sha:sha,head_branch:branch,head_repository:{full_name:repo},status:'completed',conclusion:'success',event:'pull_request',created_at:'2026-11-21T05:30:00Z',updated_at:'2026-11-21T05:30:30Z'}));
const moduleSource=readFileSync('test/owner-live-task-progress-20261121.mjs');
const cssSource=readFileSync('test/owner-live-task-progress-20261121.css');
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const files={'/owner-live-task-progress-20261121.mjs':['text/javascript',moduleSource],'/owner-live-task-progress-20261121.css':['text/css',cssSource]};
 if(files[url.pathname]){res.writeHead(200,{'content-type':files[url.pathname][0]});res.end(files[url.pathname][1]);return;}
 if(url.pathname==='/test/staging-manifest.json'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({runtimePairStatus:'UNVERIFIED'}));return;}
 if(url.pathname==='/production-release-manifest.json'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({environment:'production',businessVersion:'SH-01.30.52 v'}));return;}
 if(url.pathname==='/build-info.json'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({environment:'production',releaseVersion:'SH-01.30.59 v'}));return;}
 res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/owner-live-task-progress-20261121.css"><div class="cabinet-app" data-cabinet-role="'+(url.searchParams.get('role')||'owner')+'"><div id="lw-owner-command"><div class="lw-cc-development-list"></div></div><section id="ow-workspace"></section></div><script type="module" src="/owner-live-task-progress-20261121.mjs"></script>');
});
const response=path=>({id:0,result:path});
test('Owner sees 4 confirmed stages out of 6 with live links and mobile-width progress',async(t)=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.route('https://api.github.com/repos/hakaru4i-afk/freight-quotes-web/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const body=path.endsWith('/pulls/145')?pr:path.endsWith('/actions/runs/44899669386')?audit:path.endsWith('/actions/runs')?{workflow_runs:runs}:{jobs:[]};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const box=page.locator('[data-owner-ci-status]').first();await box.waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-owner-ci-status]')?.textContent?.includes('67%'),null,{timeout:15000});
 assert.equal(await box.getByRole('progressbar').getAttribute('aria-valuenow'),'4');
 assert.equal(await box.getByRole('progressbar').getAttribute('aria-valuemax'),'6');
 const label=await box.textContent();assert.match(label,/SH59 — выпуск портала/);assert.match(label,/Совместимость опубликованного API/);assert.match(label,/не оценка времени/);
 const layout=await page.evaluate(()=>({vw:innerWidth,card:document.querySelector('[data-owner-ci-status]')?.getBoundingClientRect().right,scroll:document.documentElement.scrollWidth}));
 assert.ok(layout.card<=layout.vw+1,'Card must fit mobile viewport: '+JSON.stringify(layout));
 assert.ok(layout.scroll<=layout.vw+1,'Page must not overflow mobile viewport: '+JSON.stringify(layout));
 await page.evaluate(()=>document.querySelector('.cabinet-app').setAttribute('data-cabinet-role','carrier'));
 await page.waitForFunction(()=>document.querySelectorAll('[data-owner-ci-status]').length===0);
 await context.close();
});
test('Unauthenticated or non-Owner screen does not fetch GitHub or mount a progress bar',async(t)=>{
 if(!server.listening)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();
 let calls=0;
 await page.route('https://api.github.com/**',route=>{calls++;return route.abort()});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?role=carrier');
 await page.waitForTimeout(450);
 assert.equal(await page.locator('[data-owner-ci-status]').count(),0);
 assert.equal(calls,0);
});
