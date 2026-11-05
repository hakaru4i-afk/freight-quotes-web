/* Issue #47 staging: eliminate duplicate rate-entry actions in the carrier request card. */
(() => {
  "use strict";
  if (!location.pathname.includes("/test/")) return;
  const text = node => (node?.textContent || "").replace(/\\s+/g, " ").trim();
  function reconcile() {
    const scope = document.querySelector("main");
    if (!scope) return;
    const controls = [...scope.querySelectorAll("button,a,[role=button]")];
    const primary = controls.filter(node => text(node) === "Открыть заявку и дать ставку");
    if (!primary.length) return;
    for (const duplicate of controls) {
      if (text(duplicate) !== "Начать расчёт ставки") continue;
      let parent = duplicate.parentElement, matched = false;
      for (let i = 0; parent && i < 5; i++, parent = parent.parentElement) {
        if (primary.some(p => parent.contains(p))) { matched = true; break; }
      }
      if (matched) {
        duplicate.hidden = true;
        duplicate.setAttribute("aria-hidden", "true");
        duplicate.tabIndex = -1;
        duplicate.style.display = "none";
      }
    }
  }
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; reconcile(); });
  };
  document.addEventListener("DOMContentLoaded", schedule);
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  schedule();
})();
