/* Staging: clarify existing sidebar label. Navigation stays in left sidebar only. */
(() => {
  "use strict";
  const terms = {ru:"Транспортные заявки",en:"Transport applications",zh:"运输委托书"};
  const label=()=>terms[(document.documentElement.lang||"ru").slice(0,2)]||terms.ru;
  function apply(){
    document.querySelectorAll('a[href="#transport-applications"],button[data-section="transport-applications"]').forEach(el=>{
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(node.nodeValue.includes("Транспортная заявка · документ"))
          node.nodeValue=node.nodeValue.replaceAll("Транспортная заявка · документ",label());
      }
    });
  }
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply()});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["lang"]});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});
  else apply();
})();
