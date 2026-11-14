// Optional managed-cloud transport adapter. Every response comes from the real
// HTTPS server through Node's configured CA/proxy; TLS verification stays enabled.
import{chromium}from'playwright';
if(process.env.QA_TLS_VERIFIED_HTTP_BRIDGE==='true'){
 const launch=chromium.launch.bind(chromium);
 chromium.launch=async options=>{
  const browser=await launch(options),create=browser.newContext.bind(browser);
  browser.newContext=async options=>{
   const context=await create(options);
   await context.route('https://**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(!['hakaru4i-afk.github.io','ibclzdkxiozbzmniiygv.supabase.co'].includes(u.hostname)){await route.continue();return;}
    const headers=await req.allHeaders();for(const h of ['host','connection','content-length','accept-encoding'])delete headers[h];
    try{
     const r=await fetch(u,{method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),redirect:'manual',signal:AbortSignal.timeout(60000)});
     const responseHeaders=Object.fromEntries(r.headers);for(const h of ['content-encoding','content-length','transfer-encoding'])delete responseHeaders[h];
     await route.fulfill({status:r.status,headers:responseHeaders,body:Buffer.from(await r.arrayBuffer())});
    }catch{await route.abort('failed');}
   });return context;
  };return browser;
 };
}
