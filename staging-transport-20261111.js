/* Fixed production host and exact versioned release endpoints. Preserve every operation; never retry mutations. */
(()=>{'use strict';if(window.__stagingTransportInstalled)return;window.__stagingTransportInstalled=true;const original=window.fetch.bind(window);
window.fetch=function(input,init){
 const value=input instanceof Request?input.url:String(input);let url;try{url=new URL(value,location.href);}catch{return original(input,init);}
 if(url.hostname==='ooclsrndeygojtofuyte.supabase.co'&&/^\/functions\/v1\/freight-api(?:-release-[a-f0-9]{32})?(?:\/|$)/.test(url.pathname)){
  url.searchParams.set('forceFunctionRegion','eu-central-1');return original(input instanceof Request?new Request(url.href,input):url.href,init);
 }
 return original(input,init);
};})();
