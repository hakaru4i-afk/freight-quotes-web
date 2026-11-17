/* Dashboard sizing only, staging. Does not change React data or navigation. */
(()=>{"use strict";
const exact=(el,part)=>el&&el.textContent&&el.textContent.includes(part);
function mark(){
 const scope=document.querySelector(".carrier-portal")||document;
 const headings=[...scope.querySelectorAll("h1,h2,h3")];
 const heading=headings.find(x=>exact(x,"Ближе к грузу")&&exact(x,"Проще в работе"));
 if(!heading)return;
 let hero=heading.closest(".workspace-hero");
 if(!hero){
   let n=heading.parentElement;
   for(let i=0;n&&i<5;i++,n=n.parentElement){
     if(exact(n,"Service Level")&&n.querySelectorAll("a,button").length<12){hero=n;break;}
   }
 }
 if(!hero)return;
 hero.setAttribute("data-carrier-compact-hero","");
 const service=[...hero.querySelectorAll("*")].find(x=>x.children.length===0&&x.textContent.trim()==="Service Level");
 if(!service)return;
 let target=service.parentElement;
 for(let i=0;target&&i<4;i++,target=target.parentElement){
   const t=target.textContent||"";
   if(t.includes("100")&&t.includes("Service Level")&&t.length<150){break;}
 }
 if(target&&target!==hero&&hero.contains(target))target.setAttribute("data-carrier-sl-compact","");
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mark();});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule);else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
})();