/* OWNER-WORKSPACE-01 · Staging-only presentation grouping. Preserve React routes, capabilities and role access. */
(()=>{"use strict";
const groups=[
 {id:"desk",titles:{ru:"Рабочий стол",en:"Workspace",zh:"工作台"},ids:["overview"]},
 {id:"requests",titles:{ru:"01 · Заявки и ставки",en:"01 · Requests & quotes",zh:"01 · 询价与报价"},ids:["create-request","request-registry","offers","answers","tender-hub"]},
 {id:"execution",titles:{ru:"02 · Исполнение",en:"02 · Execution",zh:"02 · 运输执行"},ids:["approved-shipments","winner-chats","transport-claims","incident-journal"]},
 {id:"partners",titles:{ru:"03 · Контрагенты",en:"03 · Partners",zh:"03 · 合作伙伴"},ids:["supplier-orders","content-tasks"]},
 {id:"control",titles:{ru:"04 · Контроль и аналитика",en:"04 · Oversight & analytics",zh:"04 · 分析与监控"},ids:["management-reports","carrier-service","sla","site-monitor"]},
 {id:"settings",titles:{ru:"05 · Управление",en:"05 · Administration",zh:"05 · 管理"},ids:["team","access-levels","portal-feedback"]},
 {id:"help",titles:{ru:"Справка",en:"Help",zh:"帮助"},ids:["help"]}
];
const byId=new Map(groups.flatMap((g,i)=>g.ids.map((id,j)=>[id,{group:g,order:i*20+j+1}])));
const locale=()=>{let l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("en")?"en":l.startsWith("zh")?"zh":"ru"};
let queued=false;
function apply(){
 const cabinet=document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
 const nav=cabinet?.querySelector(".cabinet-sidebar nav");
 if(nav){
   nav.classList.add("lw-owner-nav");
   const lang=locale();
   const seen=new Set(),started=new Set();
   for(const a of nav.querySelectorAll(':scope > a[href^="#"]')){
     const id=a.getAttribute("href").slice(1),info=byId.get(id);
     if(id==="transport-applications"){
       a.dataset.lwOwnerDeferred="true";a.title=lang==="ru"?"Транспортная заявка отложена; процесс исполнения доступен отдельно.":lang==="en"?"Transport application deferred; execution remains a separate process.":"运输申请暂缓；执行流程独立。";
       a.setAttribute("aria-hidden","true");a.tabIndex=-1;continue;
     }
     if(seen.has(id)){a.dataset.lwOwnerDuplicate="true";a.setAttribute("aria-hidden","true");a.tabIndex=-1;continue}
     seen.add(id);
     if(!info)continue;
     a.style.setProperty("--lw-owner-order",String(info.order));
     a.dataset.lwOwnerGroup=info.group.id;
     const title=info.group.titles[lang];
     if(!started.has(info.group.id)){
       a.dataset.lwOwnerGroupStart=title;started.add(info.group.id);
     }else delete a.dataset.lwOwnerGroupStart;
   }
   cabinet.dataset.lwOwnerHierarchy="20261108";
 }
 const preview=document.querySelector(".test-cabinets");
 if(preview&&!preview.classList.contains("lw-preview-compact")){
   preview.classList.add("lw-preview-compact");
   const small=preview.querySelector(".cabinet-preview-info small");
   if(small){const info=preview.querySelector(".cabinet-preview-info");if(info&&!info.title)info.title=small.textContent||""}
 }
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.getElementById("root")||document.body,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
document.addEventListener("DOMContentLoaded",schedule);
window.addEventListener("hashchange",schedule);
window.addEventListener("freight-access-updated",schedule);
schedule();
})();