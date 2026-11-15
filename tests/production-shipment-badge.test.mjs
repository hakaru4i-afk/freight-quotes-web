import test from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{chromium}from'playwright';
test('production shipment counts stay on one line at mobile width for Owner Carrier and VED',{skip:!existsSync('production-release-manifest.json')},async()=>{
 const html=readFileSync('index.html','utf8'),names=[...html.matchAll(/href="\.\/([^"?]+\.css)(?:\?[^"\s]*)?"/g)].map(m=>m[1]),css=names.map(n=>readFileSync(n,'utf8')).join('\n'),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage({viewport:{width:390,height:844}});for(const role of['owner','carrier','logistic'])for(const count of[12,29,999]){
 await page.setContent('<style>'+css+'</style><div id="root"><main class="cabinet-app carrier-portal" data-cabinet-role="'+role+'"><div id="task2-root"><div class="t2-list-filters"><button class="t2-list-filter is-active">Новые и в работе <span>'+count+'</span></button><button class="t2-list-filter">Архив <span>11</span></button></div></div></main></div>');
 const box=await page.locator('.t2-list-filter.is-active > span').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);return{lines:r.getClientRects().length,width:e.clientWidth,scroll:e.scrollWidth,whiteSpace:getComputedStyle(e).whiteSpace,text:e.textContent};});assert.equal(box.text,String(count));assert.equal(box.lines,1,role+' '+count);assert.equal(box.whiteSpace,'nowrap');assert.ok(box.scroll<=box.width+1);
 }}finally{await browser.close();}
});
