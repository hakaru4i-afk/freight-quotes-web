/* SH-01.30.53 / OW-01.30.48: visible release state and version across portal. */
(()=>{'use strict';
if(window.__lwReleaseStatus20261117)return;window.__lwReleaseStatus20261117=true;
const script=document.currentScript;
const base=script?.src||document.baseURI;
const params=new URL(base).searchParams;
const declared=params.get('businessVersion')||params.get('v')||'';
const loaded=/^SH-\d{2}\.\d{2}\.\d{2} v$/.test(declared)?declared:'';
const manifest=new URL('./release-status.json',base);
const root=document.createElement('aside');
root.id='lw-release-status';root.setAttribute('aria-live','polite');root.hidden=true;
let data=null,collapsed=false,currentRole='';
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const language=()=>{const x=(document.documentElement.lang||'ru').slice(0,2);return ['ru','en','zh'].includes(x)?x:'ru'};
const tr={
ru:{updating:'Идёт обновление портала',checking:'Публикация проверяется',released:'Обновление опубликовано',failed:'Обновление требует проверки',details:'Что исправлено',hide:'Свернуть',expand:'Версия',reload:'Обновить страницу',register:'Реестр обновлений',stale:'Доступна новая версия'},
en:{updating:'Portal update in progress',checking:'Release under verification',released:'Update published',failed:'Release needs verification',details:'What changed',hide:'Collapse',expand:'Version',reload:'Reload page',register:'Update register',stale:'New version available'},
zh:{updating:'门户正在更新',checking:'正在验证发布',released:'更新已发布',failed:'发布需要检查',details:'更新内容',hide:'收起',expand:'版本',reload:'刷新页面',register:'更新记录',stale:'发现新版本'}
};
const owner=()=>!!document.querySelector('#root .cabinet-app[data-cabinet-role="owner"],#root .staff-portal[data-cabinet-role="owner"]');
const signed=()=>!!document.querySelector('#root .cabinet-app[data-cabinet-role],#root .staff-portal[data-cabinet-role]');
const stamp=()=>data?.version||'—';
function paint(){
 const role=signed()?(owner()?'owner':'staff'):'guest';if(role==='guest'){root.hidden=true;currentRole=role;return}currentRole=role;
 const t=tr[language()],state=loaded?(data?.status||'checking'):'checking',newer=!!loaded&&!!data?.version&&loaded!==data.version;
 const title=newer?t.stale:(t[state]||t.checking);
 // A completed deployment is not an ongoing notification. Keep the change history in 'Что нового'.
 if(state==='released'&&!newer){root.hidden=true;root.dataset.state=state;root.innerHTML='';return}
 const notes=role==='owner'&&Array.isArray(data?.changes)?data.changes:[];
 root.hidden=false;root.dataset.state=state;root.classList.toggle('is-collapsed',collapsed);
 if(collapsed){root.innerHTML='<button type="button" data-release-toggle="open">'+html(t.expand)+' '+html(stamp())+'</button>';return}
 root.innerHTML='<div class="lw-release-header"><strong>'+html(title)+'</strong><button type="button" data-release-toggle="close" aria-label="'+html(t.hide)+'">×</button></div>'+
 '<div class="lw-release-version">'+html(stamp())+(role==='owner'&&data?.ownerVersion?' · '+html(data.ownerVersion):'')+'</div>'+
 (role==='owner'&&notes.length?'<div class="lw-release-subtitle">'+html(t.details)+'</div><ul>'+notes.map(n=>'<li>'+html(n)+'</li>').join('')+'</ul>':'')+
 '<div class="lw-release-actions">'+(newer?'<button type="button" data-release-reload="1">'+html(t.reload)+'</button>':'')+
 (role==='owner'?'<a href="#updates">'+html(t.register)+'</a>':'')+'</div>';
}
root.addEventListener('click',e=>{
 const toggler=e.target.closest('[data-release-toggle]');
 if(toggler){collapsed=toggler.dataset.releaseToggle==='close';paint();return}
 if(e.target.closest('[data-release-reload]'))location.reload();
});
async function load(){
 try{
  const url=new URL(manifest);url.searchParams.set('t',String(Date.now()));
  const response=await fetch(url.href,{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const next=await response.json();
  if(typeof next.version!=='string'||!['updating','checking','released','failed'].includes(next.status))throw Error('INVALID_RELEASE_STATUS');
  data=next;
 }catch(e){if(!data)data={version:loaded||'—',status:'checking',changes:[]}}
 paint();
}
let tick=false;new MutationObserver(()=>{if(tick)return;tick=true;requestAnimationFrame(()=>{tick=false;const role=signed()?(owner()?'owner':'staff'):'guest';if(role!==currentRole)paint()})}).observe(document.documentElement,{subtree:true,childList:true});
function start(){document.body.append(root);load();setInterval(load,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
