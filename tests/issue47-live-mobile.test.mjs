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
