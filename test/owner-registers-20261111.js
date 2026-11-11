/* OW-01.30.46 v: staging-only navigation to protected registers and latest process scheme. */
(()=>{"use strict";
const docs={
 updates:{ru:"Реестр обновлений",en:"Updates register",zh:"更新登记册",file:"UPDATES.md"},
 remarks:{ru:"Реестр замечаний",en:"Remarks register",zh:"问题登记册",file:"REMARKS.md"},
 developments:{ru:"Реестр разработок",en:"Development register",zh:"开发登记册",file:"DEVELOPMENT.md"}
};
const ids=["updates","remarks","developments","cooperation","process"];
const locales={
 ru:{cooperation:"Реестр предложений по сотрудничеству",process:"Структура бизнес-процессов",group:"06 · Реестры и процессы",help:"FAQ и инструкции по кабинетам",archive:"Полный архив GitHub",info:"Актуальные обращения, решения и статусы из защищённого Центра доработок. Полная история обновлений, замечаний и разработок хранится в GitHub.",flow:"Схема бизнес-процессов · 11.11.2026",flowInfo:"Действующая модель 20261111-logic-8 по ролям и этапам. Просмотр здесь; редактируемый файл draw.io доступен на странице схемы.",open:"Полноэкранный просмотр"},
 en:{cooperation:"Cooperation proposals register",process:"Business process structure",group:"06 · Registers & processes",help:"FAQ and role instructions",archive:"Full GitHub archive",info:"Current requests, decisions and statuses from the secured Improvement Center. The complete version history is in GitHub.",flow:"Business process map · 11 Nov 2026",flowInfo:"Current model 20261111-logic-8 by roles and stages; editable draw.io diagram is available on the map page.",open:"Full-screen map"},
 zh:{cooperation:"合作申请登记册",process:"业务流程结构",group:"06 · 登记册与流程",help:"常见问题与岗位说明",archive:"GitHub 完整档案",info:"受保护改进中心显示当前申请、决策和状态。完整历史请查看 GitHub。",flow:"业务流程图 · 2026年11月11日",flowInfo:"现行20261111-logic-8模型按岗位展示；draw.io编辑文件在流程图页面提供。",open:"完整流程图"}
};
const lang=()=>{let l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("zh")?"zh":l.startsWith("en")?"en":"ru"};
let selected="",scrollPartner=false,scheduled=false;
const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
function updateHelpLinks(){
 for(const nav of document.querySelectorAll(".cabinet-app .cabinet-sidebar nav")){
  const el=nav.querySelector('a[href="#help"]');if(!el)continue;
  const t=[...el.childNodes].find(n=>n.nodeType===3);
  if(t&&t.textContent!==locales[lang()].help)t.textContent=locales[lang()].help;
 }
}
function menu(){
 const cab=owner(),nav=cab?.querySelector(".cabinet-sidebar nav");if(!nav)return;
 for(const id of ids){
  let a=nav.querySelector('[data-ow-register="'+id+'"]');
  if(!a){a=document.createElement("a");a.href=id==="cooperation"?"#overview":"#portal-feedback";a.dataset.owRegister=id;
   const icon=document.createElement("span");icon.setAttribute("aria-hidden","true");icon.textContent=id==="cooperation"?"✉":id==="process"?"◇":"▤";
   a.append(icon,document.createTextNode(""));nav.append(a);}
  const n=[...a.childNodes].find(x=>x.nodeType===3),value=(docs[id]||locales[lang()])[lang()]||locales[lang()][id];
  if(n&&n.textContent!==value)n.textContent=value;
  a.setAttribute("aria-label",value);a.setAttribute("aria-current",selected===id?"page":"false");
  a.dataset.lwOwnerGroup="registers";
  if(id==="updates")a.dataset.lwOwnerGroupStart=locales[lang()].group;
  a.style.setProperty("--lw-owner-order",String(106+ids.indexOf(id)));
 }
}
function removeUnused(host,except){
 for(const name of ["#ow-register-head","#ow-business-process"]){
  if(name!==except)host.querySelector(name)?.remove();
 }
}
function showRegistry(host,root){
 let head=host.querySelector("#ow-register-head");
 if(!head){head=document.createElement("header");head.id="ow-register-head";root.before(head);}
 const l=lang(),info=docs[selected];if(!info)return;
 head.replaceChildren();
 const h=document.createElement("h2");h.textContent=info[l];
 const v=document.createElement("small");v.textContent="OW-01.30.46 v";
 const p=document.createElement("p");p.textContent=locales[l].info;
 const a=document.createElement("a");a.href="https://github.com/hakaru4i-afk/freight-quotes/blob/main/docs/registries/"+info.file;
 a.target="_blank";a.rel="noopener noreferrer";a.textContent=locales[l].archive;
 head.append(h,v,p,a);
 const filter=root.querySelector("#pf-register");
 if(filter&&filter.value!==selected){filter.value=selected;filter.dispatchEvent(new Event("change",{bubbles:true}));}
}
function showProcess(host,root){
 let section=host.querySelector("#ow-business-process");
 if(!section){
  section=document.createElement("section");section.id="ow-business-process";
  const heading=document.createElement("h2"),v=document.createElement("small"),p=document.createElement("p"),a=document.createElement("a"),frame=document.createElement("iframe");
  heading.className="ow-process-title";v.textContent="OW-01.30.46 v";p.className="ow-process-info";a.className="ow-process-full";
  a.href="./process-map.html";a.target="_blank";a.rel="noopener noreferrer";
  frame.src="./process-map.html";frame.id="ow-process-frame";frame.loading="lazy";frame.referrerPolicy="no-referrer";
  frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-downloads");
  section.append(heading,v,p,a,frame);root.before(section);
 }
 const l=lang();
 section.querySelector(".ow-process-title").textContent=locales[l].flow;
 section.querySelector(".ow-process-info").textContent=locales[l].flowInfo;
 section.querySelector(".ow-process-full").textContent=locales[l].open;
 section.querySelector("iframe").title=locales[l].process;
}
function render(){
 updateHelpLinks();const cab=owner();if(!cab)return;menu();
 if(selected&&location.hash!==(selected==="cooperation"?"#overview":"#portal-feedback"))selected="";
 cab.dataset.owRegisterView=selected;
 const host=cab.querySelector(".cabinet-content");if(!host)return;
 const root=host.querySelector("#portal-feedback-root");
 if(!selected||selected==="cooperation"){removeUnused(host);}
 else if(root){
  if(selected==="process"){removeUnused(host,"#ow-business-process");showProcess(host,root);}
  else{removeUnused(host,"#ow-register-head");showRegistry(host,root);}
 }
 if(scrollPartner&&selected==="cooperation"){
  const el=cab.querySelector("#lw-owner-inquiries");
  if(el&&el.getClientRects().length){scrollPartner=false;el.scrollIntoView({block:"start"});}
 }
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()});}
document.addEventListener("click",e=>{
 const cab=owner();if(!cab)return;
 const custom=e.target.closest?.('a[data-ow-register]');
 if(custom&&cab.contains(custom)){e.preventDefault();e.stopPropagation();
  selected=custom.dataset.owRegister;scrollPartner=selected==="cooperation";
  const hash=selected==="cooperation"?"#overview":"#portal-feedback";
  if(location.hash!==hash)location.hash=hash;schedule();return;
 }
 const regular=e.target.closest?.('.cabinet-sidebar nav a[href^="#"]');
 if(regular&&cab.contains(regular)){selected="";scrollPartner=false;schedule();}
},true);
window.addEventListener("hashchange",schedule);
window.addEventListener("popstate",schedule);
window.addEventListener("freight-access-updated",schedule);
new MutationObserver(schedule).observe(document.getElementById("root")||document.body,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule);else schedule();
window.owOwnerRegistersVersion="OW-01.30.46 v";
})();