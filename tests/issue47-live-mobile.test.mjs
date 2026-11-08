import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";

const url="https://hakaru4i-afk.github.io/freight-quotes-web/test/";
test("served staging login loads without JavaScript crashes on mobile and desktop",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];
   page.on("pageerror",err=>errors.push(err.message));
   const response=await page.goto(url+"?page=login",{waitUntil:"domcontentloaded",timeout:40000});
   assert.equal(response?.status(),200);
   await page.waitForTimeout(2200);
   const diagnostics=await page.evaluate(()=>({
    title:document.title,
    text:document.body?.textContent?.trim()?.slice(0,200)||"",
    viewport:innerWidth,
    width:document.documentElement.scrollWidth,
    language:document.documentElement.lang
   }));
   assert.ok(diagnostics.text.length>12,"Login page is empty/white");
   assert.ok(diagnostics.width<=viewport.width+4,"Horizontal overflow on "+viewport.width+"px: "+diagnostics.width);
   assert.deepEqual(errors,[],"Unhandled JavaScript errors in "+viewport.width+"px view");
   await page.close();
  }
 }finally{await browser.close();}
});
test("RU/EN/ZH locales retain document language on live staging portal",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(url+"?page=login",{waitUntil:"domcontentloaded",timeout:40000});
  for(const [stored,expected] of [["ru","ru"],["en","en"],["zh","zh-CN"]]){
   await page.evaluate(lang=>localStorage.setItem("freight-language",lang),stored);
   await page.reload({waitUntil:"domcontentloaded",timeout:40000});
   await page.waitForTimeout(400);
   const lang=await page.evaluate(()=>document.documentElement.lang);
   assert.equal(lang,expected,"Locale "+stored+" not reflected in document");
  }
 }finally{await browser.close();}
});


test("LW-PUBLIC-01 staging landing has exactly one visible sign-in and a globe",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
   const page=await browser.newPage({viewport});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(url+"?page=login",{waitUntil:"domcontentloaded",timeout:40000});
   assert.equal(response?.status(),200);
   await page.locator('.cycle-landing[data-lw-public="20261108"]').waitFor({timeout:25000});
   const result=await page.evaluate(()=>{
    const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden";
    const loginControls=[...document.querySelectorAll('.cycle-landing button, .cycle-landing a')].filter(e=>visible(e)&&/^(Войти|Sign in|登录)/i.test((e.textContent||"").trim()));
    return {
     loginControls:loginControls.map(e=>({text:e.textContent.trim(),inForm:!!e.closest(".cycle-login form")})),
     h1:document.querySelector(".cycle-hero h1")?.textContent?.trim(),
     globe:visible(document.querySelector(".lw-globe")),
     partner:visible(document.querySelector("[data-lw-cooperation]")),
     globeSrc:getComputedStyle(document.querySelector(".lw-globe")).backgroundImage,
     freightSrc:getComputedStyle(document.querySelector(".cycle-hero"),"::after").backgroundImage,
     darkLogin:getComputedStyle(document.querySelector(".cycle-login")).color,
     overflowing:document.documentElement.scrollWidth>innerWidth+4,
     loadingOldCTA:visible(document.querySelector(".cycle-hero-links .cycle-cta")),
     loadingHeaderLogin:visible(document.querySelector(".cycle-header .cycle-signin-link")),
    };
   });
   assert.equal(result.h1?.replace(/\s/g,""),"LogisticsWorkspace");
   assert.equal(result.loginControls.length,1,"Visible duplicate login actions: "+JSON.stringify(result.loginControls));
   assert.equal(result.loginControls[0].inForm,true,"Only remaining login action must be in form");
   assert.equal(result.globe,true,"Glowing 3D globe missing");
   assert.equal(result.partner,true,"Cooperation entry missing from approved navigation");
   assert.match(result.globeSrc,/lw-approved-globe-20261108/,"Approved globe photo not installed");
   assert.match(result.freightSrc,/lw-approved-freight-20261108/,"Approved transport scene not installed");
   for(const asset of ["lw-approved-globe-20261108.jpg","lw-approved-freight-20261108.jpg","lw-approved-plane-20261108.jpg"]){
    const response=await page.request.get(new URL(asset,url).toString(),{timeout:25000});
    assert.equal(response.status(),200,"Missing served approved visual asset "+asset);
    const bytes=await response.body();
    assert.ok(bytes.length>2000,"Empty image asset: "+asset);
    assert.equal(bytes[0],0xff,"Invalid JPEG: "+asset);
    assert.equal(bytes[1],0xd8,"Invalid JPEG: "+asset);
   }

   assert.equal(result.darkLogin,"rgb(248, 247, 248)","Approved dark login theme missing");
   assert.equal(result.loadingOldCTA,false,"Old hero login CTA still visible");
   assert.equal(result.loadingHeaderLogin,false,"Old header login CTA still visible");
   assert.equal(result.overflowing,false,"Horizontal overflow at "+viewport.width);
   assert.deepEqual(errors,[],"Browser errors at "+viewport.width);
   await page.close();
  }
 } finally{await browser.close()}
});
