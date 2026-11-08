
/* LW-PUBLIC-02: exact approved orange-dark scene; real React auth remains intact. */
(()=> {
const tr={
ru:{about:"О портале",partner:"Сотрудничество",help:"Поддержка"},
en:{about:"About",partner:"Partnership",help:"Support"},
zh:{about:"关于平台",partner:"合作",help:"支持"}};
let pending=false;
const observer=new MutationObserver(()=>queue());
function lang(){let l=document.documentElement.lang||"ru";return l.startsWith("zh")?"zh":l.startsWith("en")?"en":"ru"}
function queue(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})}
function apply(){
 const root=document.querySelector(".cycle-landing");if(!root)return;
 const hero=root.querySelector(".cycle-hero");if(!hero)return;
 if(!hero.querySelector(".lw-approved-plane")){const el=document.createElement("div");el.className="lw-approved-plane";el.setAttribute("aria-hidden","true");hero.appendChild(el)}
 const nav=root.querySelector(".cycle-header nav");
 if(nav){
  const t=tr[lang()];
  const about=nav.querySelector('a[href="#cycle-process"]');
  if(about&&about.textContent!==t.about)about.textContent=t.about;
  let partner=nav.querySelector('[data-lw-cooperation]');
  if(!partner){partner=document.createElement("a");partner.href="#lw-partners";partner.setAttribute("data-lw-cooperation","true");nav.insertBefore(partner,nav.querySelector(".cycle-signin-link")||null)}
  if(partner.textContent!==t.partner)partner.textContent=t.partner;
  let help=nav.querySelector('[data-lw-support]');
  if(!help){help=document.createElement("a");help.href="?page=help";help.setAttribute("data-lw-support","true");nav.insertBefore(help,nav.querySelector(".cycle-signin-link")||null)}
  if(help.textContent!==t.help)help.textContent=t.help;
 }
 root.dataset.lwApproved="cinematic-20261108";
}
const root=document.getElementById("root")||document.body;
observer.observe(root,{childList:true,subtree:true});
new MutationObserver(queue).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
queue();
})();
