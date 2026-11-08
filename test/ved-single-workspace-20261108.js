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
  const keep=section==='overview'||section==='approved-shipments';
  a.hidden=!keep;
  if(!keep){a.setAttribute('aria-hidden','true');a.tabIndex=-1}
  else{a.removeAttribute('aria-hidden');a.removeAttribute('tabindex')}
 }
 let active=nav.querySelector('a[href="#approved-shipments"]');
 if(!active){
  active=document.createElement('a');
  active.href='#approved-shipments';
  active.className='ved-active-shipments-link';
  active.textContent='Активные перевозки';
  const overview=nav.querySelector('a[href="#overview"]');
  if(overview)overview.insertAdjacentElement('afterend',active);
  else nav.append(active);
 }
 active.hidden=false;
 active.removeAttribute('aria-hidden');
 active.removeAttribute('tabindex');
 active.style.setProperty('display','flex','important');
 cabinet.dataset.vedWorkspace='active-shipments-20261108';
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',schedule);window.addEventListener('hashchange',schedule);schedule();
})();
