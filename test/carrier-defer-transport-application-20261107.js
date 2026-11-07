/* Carrier transport-application authoring deferred in /test/.
   Redirect legacy deep links only for the carrier role; never delete documents. */
(()=>{
 "use strict";
 function reconcile(){
   if(!document.querySelector('.carrier-portal[data-cabinet-role="carrier"]'))return;
   if(location.hash==="#transport-applications"){
     location.replace(location.pathname+location.search+"#approved-shipments");
   }
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",reconcile,{once:true});
 else reconcile();
 window.addEventListener("hashchange",reconcile);
 const obs=new MutationObserver(()=>{
   if(document.querySelector('.carrier-portal[data-cabinet-role="carrier"]')){
     reconcile();obs.disconnect();
   }
 });
 obs.observe(document.documentElement,{childList:true,subtree:true});
})();
