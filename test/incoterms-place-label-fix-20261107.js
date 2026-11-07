/* Staging-only wording change. No changes to field names, values or validation. */
(() => {
  "use strict";
  const from = "Именованное место / порт Incoterms";
  const to = "Место поставки по Incoterms";
  function apply() {
    document.querySelectorAll("label").forEach(label => {
      if (!label.textContent?.includes(from)) return;
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.includes(from)) node.nodeValue = node.nodeValue.replaceAll(from, to);
      }
    });
  }
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {queued = false; apply();});
  });
  observer.observe(document.documentElement, {childList:true,subtree:true});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, {once:true});
  else apply();
})();
