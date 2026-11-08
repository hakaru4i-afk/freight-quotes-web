/* VED-01: keep only active workspace navigation; do not grant access or alter routes. */
(()=>{'use strict';
let queued=false;
function apply(){
 const cabinet=document.querySelector('.cabinet-app[data-cabinet-role="ved"]');
 if(!cabinet)return;
 const nav=cabinet.querySelector('.cabinet-sidebar nav');
 if(!nav)return;
 for(const a of nav.querySelectorAll('a[href^="#"]')){
  const section=a.getAttribute('href').slice(1);
  const keep=section==='overview';
  a.hidden=!keep;
  if(!keep){a.setAttribute('aria-hidden','true');a.tabIndex=-1}
  else{a.removeAttribute('aria-hidden');a.removeAttribute('tabindex')}
 }
 cabinet.dataset.vedWorkspace='single-section-20261108';
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',schedule);window.addEventListener('hashchange',schedule);schedule();
})();
