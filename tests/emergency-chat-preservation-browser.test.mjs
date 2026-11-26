import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const read=p=>readFileSync('test/'+p,'utf8');
const html=read('index.html'),styles=[...html.matchAll(/href="\.\/([^"?]+\.css)(?:\?[^"]*)?"/g)].map(m=>read(m[1])).join('\n');
test('emergency chat hotfix survives staging: winning carrier, server write permission and readable input',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:844}});
   let writable=true,posts=0;
   await page.route('http://localhost:8811/**',async route=>{
    const r=route.request(),u=new URL(r.url());
    if(u.pathname==='/api/chats'){
     if(r.method()==='POST'){posts++;await route.fulfill({json:{ok:true}});return;}
     await route.fulfill({json:u.searchParams.has('id')?{writable,chat:{carrier_name:'Winner QA'},messages:[{body:'Incoming',sender_id:'carrier',sender_role:'carrier'}],viewer:'ved',reason:'Access restricted',lastSeq:0}:{chats:[{id:'chat-1',order_code:'TR-QA',source_kind:'request',writable:true,carrier_name:'Winner QA'}],awards:[]}});
     return;
    }
    await route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"><div class="cabinet-app staff-portal" data-cabinet-role="ved"><div class="lw-ved-chat-mount" data-lw-ved-chat-order="TR-QA"></div></div></div></html>'});
   });
   await page.goto('http://localhost:8811/');
   await page.addStyleTag({content:styles});
   await page.addScriptTag({content:read('lw-ved-shared-chat-20261109.js')});
   await page.waitForFunction(()=>document.querySelector('[data-vc-winner]')?.textContent.includes('Winner QA')&&!document.querySelector('[data-vc-send]').hidden);
   const input=page.locator('[data-vc-send] textarea');
   await input.fill('QA message');
   const ink=await input.evaluate(e=>[getComputedStyle(e).color,getComputedStyle(e).webkitTextFillColor]);
   assert.deepEqual(ink,['rgb(24, 52, 79)','rgb(24, 52, 79)']);
   await page.locator('[data-vc-submit]').click();
   await page.waitForFunction(()=>document.querySelector('[data-vc-status]')?.textContent==='Сообщение отправлено.');
   assert.equal(posts,1);
   writable=false;
   await page.locator('[data-vc-refresh]').click();
   await page.waitForFunction(()=>document.querySelector('[data-vc-send]').hidden&&!document.querySelector('[data-vc-access]').hidden);
   assert.match(await page.locator('[data-vc-access]').innerText(),/Access restricted/);
   assert.equal(posts,1);
   await page.close();
  }
 }finally{await browser.close();}
});
