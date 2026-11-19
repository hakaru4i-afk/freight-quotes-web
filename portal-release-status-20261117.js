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

// Development notices are separate from release-state warnings and are served
// exclusively by authenticated, server-side role + recipient filtering.
const noticeRoot=document.createElement('aside');
noticeRoot.id='lw-dev-notices';noticeRoot.setAttribute('role','region');
noticeRoot.setAttribute('aria-label','Ход доработок портала');noticeRoot.hidden=true;
let noticeItems=[],noticeLoading=false,noticeCollapsed=false;
const noticeWords={
 ru:{title:'Доработки портала',now:'Что разрабатывается',result:'Ожидаемый результат',stage:'Этап',of:'из',over:'Срок 2 часа превышен',elapsed:'В работе',remaining:'Другие доработки',closed:'Свернуть',open:'Показать'},
 en:{title:'Portal improvements',now:'What is being developed',result:'Expected result',stage:'Stage',of:'of',over:'2-hour limit exceeded',elapsed:'In progress',remaining:'Other improvements',closed:'Collapse',open:'Show'},
 zh:{title:'门户改进',now:'正在开发',result:'预期结果',stage:'阶段',of:'共',over:'已超过2小时限制',elapsed:'进行中',remaining:'其他改进',closed:'收起',open:'展开'}
};
const noticeStatus={sent:['Получено','Received','已收到'],read:['Изучается','Under review','审核中'],evaluated:['Оценено','Evaluated','已评估'],in_progress:['В разработке','In development','开发中'],release:['Проверка выпуска','Release verification','发布验证中'],completed:['Принято владельцем','Owner accepted','所有者已验收']};
function paintNotices(){
 if(!signed()||!noticeItems.length){noticeRoot.hidden=true;noticeRoot.replaceChildren();return}
 const lang=language(),index=['ru','en','zh'].indexOf(lang),t=noticeWords[lang];
 noticeRoot.hidden=false;
 if(noticeCollapsed){
  noticeRoot.innerHTML='<button type="button" data-dev-expand="1">'+html(t.open)+' · '+html(t.title)+' ('+noticeItems.length+')</button>';
  return;
 }
 const rows=noticeItems.slice(0,3).map(item=>{
  const stage=Math.min(6,Math.max(0,Number(item.stage)||0)),total=6,percent=Math.round(stage/total*100);
  const status=noticeStatus[item.status]?.[index]||t.elapsed;
  const since=Date.parse(item.startedAt||'');
  const overdue=Number.isFinite(since)&&['in_progress','release'].includes(item.status)&&Date.now()-since>7200000;
  return '<article class="lw-dev-item"><div class="lw-dev-label">'+html(t.now)+'</div>'+
   '<strong>'+html(item.title)+'</strong>'+
   '<div class="lw-dev-label">'+html(t.result)+'</div><p>'+html(item.expectedResult)+'</p>'+
   '<div class="lw-dev-stage"><span>'+html(status)+' · '+t.stage+' '+stage+' '+t.of+' '+total+'</span><b>'+percent+'%</b></div>'+
   '<div role="progressbar" aria-label="'+html(t.stage)+'" aria-valuemin="0" aria-valuemax="6" aria-valuenow="'+stage+'" class="lw-dev-track"><span style="width:'+percent+'%"></span></div>'+
   (overdue?'<small class="lw-dev-overdue">'+html(t.over)+'</small>':'')+
   '</article>';
 }).join('');
 noticeRoot.innerHTML='<div class="lw-dev-header"><strong>'+html(t.title)+'</strong><button type="button" data-dev-collapse="1" aria-label="'+html(t.closed)+'">×</button></div>'+
 rows+(noticeItems.length>3?'<p class="lw-dev-remaining">'+html(t.remaining)+': '+(noticeItems.length-3)+'</p>':'');
}
noticeRoot.addEventListener('click',e=>{
 if(e.target.closest('[data-dev-collapse]')){noticeCollapsed=true;paintNotices();}
 if(e.target.closest('[data-dev-expand]')){noticeCollapsed=false;paintNotices();}
});
async function loadNotices(){
 if(noticeLoading)return;
 if(!signed()){noticeItems=[];paintNotices();return;}
 noticeLoading=true;
 try{
  const response=await fetch('/api/portal-feedback?view=notices',{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw Error('NO_ROLE_SCOPED_NOTICES');
  const data=await response.json();
  if(!data?.ok||!Array.isArray(data.items))throw Error('INVALID_NOTICE_FORMAT');
  noticeItems=data.items.filter(x=>typeof x?.title==='string'&&typeof x?.expectedResult==='string'&&
   Number.isInteger(x.stage)&&x.stage>=1&&x.stage<=6&&Object.hasOwn(noticeStatus,x.status)).slice(0,20);
 }catch(_error){noticeItems=[];}
 finally{noticeLoading=false;paintNotices();}
}

let tick=false;new MutationObserver(()=>{if(tick)return;tick=true;requestAnimationFrame(()=>{tick=false;const role=signed()?(owner()?'owner':'staff'):'guest';if(role!==currentRole){paint();paintNotices();if(role!=='guest')void loadNotices();}})}).observe(document.documentElement,{subtree:true,childList:true});
function start(){document.body.append(root,noticeRoot);load();void loadNotices();setInterval(load,60000);setInterval(()=>{if(!document.hidden)void loadNotices()},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();void loadNotices();}});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
