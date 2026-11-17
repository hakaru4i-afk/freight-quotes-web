/* OW-UI-20261117 · Scoped Owner-only UI alignment. No network or business writes. */
(() => {
  'use strict';
  const generic='Укажите достоверное значение и проверьте его перед сохранением.';
  let queued=false;
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru');
  function ownerPanel() {
    return document.querySelector('#root .cabinet-app[data-cabinet-role="owner"]') ||
           document.querySelector('#root .staff-portal[data-cabinet-role="owner"]');
  }
  function section(heading) {
    return heading.closest('.cabinet-panel,[data-section]') ||
           heading.closest('.cabinet-content') || heading.parentElement;
  }
  function markAudit(root) {
    root.classList.add('lw-owner-audit-ui');
    const targets=['пользователь','тип события','дата с','дата по'];
    const labels=[...root.querySelectorAll('label')];
    const fields=targets.map(t=>labels.find(l=>{
      const own=(l.firstChild?.textContent||l.textContent||'').trim();
      return norm(own).startsWith(t) && !!l.querySelector('select,input');
    }));
    if(fields.every(Boolean)) {
      let ancestor=fields[0].parentElement;
      while(ancestor && ancestor!==root && !fields.every(x=>ancestor.contains(x))) ancestor=ancestor.parentElement;
      if(ancestor && fields.every(x=>ancestor.contains(x)) && ancestor.children.length<=10) {
        ancestor.classList.add('lw-owner-audit-filters');
      }
      fields.forEach(field=>field.classList.add('lw-owner-audit-field'));
    }
    root.querySelectorAll('small,span,p,div').forEach(el=>{
      if((el.children.length===0 || el.tagName==='SMALL') && el.textContent.trim()===generic){
        el.classList.add('lw-owner-generic-validation-hint');
      }
    });
  }
  function sync() {
    queued=false;
    const owner=ownerPanel();if(!owner)return;
    const headings=[...owner.querySelectorAll('h1,h2,h3,h4')];
    for(const h of headings) {
      const label=norm(h.textContent);
      if(label.includes('sla ответов') && label.includes('журнал отправок')) {
        const panel=section(h);
        if(panel)panel.classList.add('lw-owner-sla-ui');
      }
      if(label==='работа сайта' || label.includes('журнал событий')) {
        const panel=section(h);
        if(panel)markAudit(panel);
      }
    }
  }
  const observer=new MutationObserver(()=>{
    if(!queued){queued=true;queueMicrotask(sync);}
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
})();
