import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const css=readFileSync('test/owner-ui-unification-20261117.css','utf8');
const js=readFileSync('test/owner-ui-unification-20261117.js','utf8');
const hint='Укажите достоверное значение и проверьте его перед сохранением.';
const cards=['89%','76%','0','12 мин'].map((v,i)=>'<div class="metric"><strong>'+v+'</strong><span>Показатель SLA '+(i+1)+'</span></div>').join('');
const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
+'<style>body{margin:0;background:#112d48;font:14px Arial;color:#fff}#root{padding:12px}.cabinet-panel{width:100%;box-sizing:border-box;margin-bottom:18px}'
+'.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.metric{border-radius:15px;background:#fff;padding:24px;min-height:118px;box-sizing:border-box}'
+'.metric strong{display:block;color:#e5f1ff;font-size:32px}.metric span{color:#9ebad4}.filters{display:flex;gap:12px}.filters label{width:25%}select,input{height:44px;width:100%;box-sizing:border-box}</style>'
+'<link rel="stylesheet" href="/ui.css"><div id="root"><div class="cabinet-app" data-cabinet-role="owner">'
+'<section class="cabinet-panel" data-section="sla"><h2>SLA ответов и журнал отправок</h2><div class="summary">'+cards+'</div></section>'
+'<section class="cabinet-panel" data-section="site-monitor"><h2>Работа сайта</h2><div class="filters">'
+'<label>Пользователь<select><option>Все пользователи</option></select><small>'+hint+'</small></label>'
+'<label>Тип события<select><option>Все события</option></select><small>'+hint+'</small></label>'
+'<label>Дата с<input type="date" value="2026-11-11"/><small>'+hint+'</small></label>'
+'<label>Дата по<input type="date"/><small>'+hint+'</small></label>'
+'</div><p class="error" role="alert">Ошибка загрузки журнала</p></section></div>'
+'<div class="cabinet-app" data-cabinet-role="carrier"><section class="cabinet-panel"><h2>Работа сайта</h2><div class="filters">'
+'<label>Пользователь<select><option>Все</option></select></label></div></section></div></div>'
+'<script defer src="/ui.js"></script></html>';
const server=createServer((req,res)=>{
 if(req.url==='/ui.css'){res.setHeader('content-type','text/css');res.end(css);return}
 if(req.url==='/ui.js'){res.setHeader('content-type','text/javascript');res.end(js);return}
 res.setHeader('content-type','text/html; charset=utf-8');res.end(html);
});
function luminance(color){
 const numbers=color.match(/[\d.]+/g)?.slice(0,3).map(Number);
 assert.ok(numbers?.length===3,'CSS color should be RGB');
 const channels=numbers.map(v=>{let x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});
 return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
test('Owner SLA and journal: desktop and 390px, contrast and isolation',async t=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true});
 t.after(async()=>{await browser.close();await new Promise(ok=>server.close(ok));});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('.cabinet-panel.lw-owner-audit-ui .lw-owner-audit-filters'));
  const cards=page.locator('.lw-owner-sla-ui .summary>.metric');
  assert.equal(await cards.count(),4);
  const rect=await cards.evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
  assert.ok(rect.every(r=>r.w>130&&r.h>=95),'SLA cards must have readable dimensions');
  if(width===1440)assert.ok(rect.every(r=>Math.abs(r.y-rect[0].y)<2),'Four SLA cards should share row on desktop');
  else assert.ok(rect[1].y>rect[0].y,'Mobile SLA cards should stack');
  const colors=await cards.first().evaluate(el=>({
   bg:getComputedStyle(el).backgroundColor,
   ink:getComputedStyle(el.querySelector('strong')).color,
   label:getComputedStyle(el.querySelector('span')).color
  }));
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  assert.ok(contrast(colors.bg,colors.ink)>=4.5,'SLA numeric contrast < 4.5:1');
  assert.ok(contrast(colors.bg,colors.label)>=4.5,'SLA label contrast < 4.5:1');
  const inputs=page.locator('.lw-owner-audit-filters label :is(input,select)');
  assert.equal(await inputs.count(),4);
  const ir=await inputs.evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
  assert.ok(ir.every(r=>r.h>=44&&r.w>100),'Filters must have usable size');
  if(width===1440)assert.ok(ir.every(r=>Math.abs(r.y-ir[0].y)<2),'Four filters should share row on desktop');
  else assert.ok(ir[1].y>ir[0].y,'Mobile filters should stack');
  assert.equal(await page.locator('.lw-owner-generic-validation-hint:visible').count(),0);
  assert.equal(await page.locator('.lw-owner-audit-ui [role="alert"]:visible').count(),1);
  assert.equal(await page.locator('[data-cabinet-role="carrier"] .lw-owner-audit-ui').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal overflow');
  await page.close();
 }
});
