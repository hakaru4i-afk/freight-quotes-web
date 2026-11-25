/* LOCKED_STAGING_ISOLATION_V1 — public test UI never calls production or shared staging data. */
(()=>{'use strict';
 if(!/^(?:\/freight-quotes-web\/test(?:\/|$)|\/test(?:\/|$))/.test(location.pathname))throw Error('LOCKED_STAGING_WRONG_PATH');
 if(window.__stagingTransportInstalled)throw Error('DUPLICATE_STAGING_TRANSPORT');
 window.__stagingTransportInstalled=true;
 const original=window.fetch.bind(window);
 const host='https://ibclzdkxiozbzmniiygv.supabase.co';
 const prefix='/functions/v1/freight-api-qa-rc20261110';
 window.fetch=function(input,init){
  let url;try{url=new URL(input instanceof Request?input.url:String(input),location.href);}catch{return original(input,init);}
  if(url.hostname==='ooclsrndeygojtofuyte.supabase.co')return Promise.reject(Error('PRODUCTION_API_BLOCKED'));
  if(url.origin===location.origin&&url.pathname.startsWith('/api/'))url=new URL(host+prefix+url.pathname+url.search);
  if(url.origin===host){
   if(/^\/functions\/v1\/freight-api(?:\/|$)/.test(url.pathname))url.pathname=url.pathname.replace(/^\/functions\/v1\/freight-api(?=\/|$)/,prefix);
   if(!url.pathname.startsWith(prefix+'/'))return Promise.reject(Error('SHARED_STAGING_DATA_BLOCKED'));
   url.searchParams.set('forceFunctionRegion','eu-central-1');
   return original(input instanceof Request?new Request(url.href,input):url.href,init);
  }
  return original(input,init);
 };
})();
