/* Staging: change Incoterms place caption only; never change input names or values. */
(() => {
  "use strict";
  const oldCaption = /Именованное\s+место\s*\/\s*порт\s+Incoterms/giu;
  const newCaption = "Место поставки по Incoterms";
  const ignored = new Set(["SCRIPT","STYLE","TEXTAREA","OPTION","INPUT"]);
  function apply(root = document.getElementById("root")) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !oldCaption.test(node.nodeValue)) {
          oldCaption.lastIndex=0;
          return NodeFilter.FILTER_SKIP;
        }
        oldCaption.lastIndex=0;
        for(let el=node.parentElement;el && el!==root;el=el.parentElement) {
          if (ignored.has(el.tagName) || el.isContentEditable) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const matches=[];
    while(walker.nextNode()) matches.push(walker.currentNode);
    for(const node of matches) node.nodeValue=node.nodeValue.replace(oldCaption,newCaption);
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(() => {scheduled=false;apply();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>apply(),{once:true});
  else apply();
})();
