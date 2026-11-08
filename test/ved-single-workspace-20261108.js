/* VED-01: keep only active workspace navigation; do not grant access or alter routes. */
(()=>{'use strict';
let queued=false;
function apply(){
 const cabinet=[...document.querySelectorAll('.cabinet-app')].find(el=>/^(?:\s*)Кабинет ВЭД(?:\s*)$/i.test(el.querySelector('.cabinet-role')?.textContent||'')) || document.querySelector('.cabinet-app[data-cabinet-role="ved"]');
 if(!cabinet)return;
 cabinet.dataset.vedHomeScope='true';
 const nav=cabinet.querySelector('.cabinet-sidebar nav');
 if(!nav)return;
 for(const a of nav.querySelectorAll('a[href^="#"]')){
  const section=a.getAttribute('href').slice(1);
  const keep=section==='overview'||section==='approved-shipments';
  a.hidden=!keep;
  if(!keep)a.style.setProperty('display','none','important');
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
 const panel=cabinet.querySelector('.cabinet-panel[data-section="overview"]');
 if(panel&&!panel.querySelector('#ved-home-20261108')){
  const home=document.createElement('section');
  home.id='ved-home-20261108';
  home.innerHTML='<div class="ved-home-kicker">РАБОЧЕЕ ПРОСТРАНСТВО ВЭД</div>'+
   '<h2>Контроль активных перевозок</h2>'+
   '<p>Здесь отображаются только перевозки, которые выбранный перевозчик-победитель уже принял в работу. До принятия заявки и ставки для ВЭД недоступны.</p>'+
   '<div class="ved-home-actions"><a class="ved-home-primary" href="#approved-shipments">Открыть активные перевозки →</a></div>'+
   '<div class="ved-home-note"><strong>Что доступно в перевозке</strong><span>Исходная заявка владельца, вложенные документы, предложение победителя, маршрут и исполнение. Предложения остальных перевозчиков недоступны.</span></div>';
  panel.append(home);
  panel.dataset.vedHomeReady='true';
 }
 if(panel){
  panel.dataset.vedHomeReady='true';
  for(const child of panel.children)if(child.id!=='ved-home-20261108')child.style.setProperty('display','none','important');
 }
 if(cabinet.dataset.vedWorkspace!=='active-shipments-20261108')cabinet.dataset.vedWorkspace='active-shipments-20261108';
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',schedule);window.addEventListener('hashchange',schedule);schedule();
})();
