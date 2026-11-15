/* Generated role guidance is a safe public projection, never a private registry. */
(()=>{'use strict';let data=null,pending=false;const labels={ru:'Изменения и инструкции',en:'Changes and instructions',zh:'变更与说明'};
async function render(){
 const lang=/^zh/i.test(document.documentElement.lang)?'zh':/^en/i.test(document.documentElement.lang)?'en':'ru';
 for(const cab of document.querySelectorAll('.cabinet-app[data-cabinet-role],.sw-cabinet[data-cabinet-role]')){
  const role=cab.dataset.cabinetRole;const help=cab.querySelector('.cabinet-panel[data-section="help"],#sh-role-instructions');if(!help||!help.getClientRects().length)continue;
  if(!data){if(pending)return;pending=true;try{const r=await fetch('./alignment-role-help.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();}catch{pending=false;return;}pending=false;}
  const messages=data.roles[role]?.[lang]||[];if(!messages.length)continue;let section=help.querySelector('#alignment-role-guidance');if(!section){section=document.createElement('section');section.id='alignment-role-guidance';help.append(section);}
  const key=lang+'|'+JSON.stringify(messages);if(section.dataset.version===key)continue;section.dataset.version=key;section.replaceChildren();const h=document.createElement('h3');h.textContent=labels[lang];section.append(h);for(const text of messages){const p=document.createElement('p');p.textContent=text;section.append(p);}
 }
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;void render();});};new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{subtree:true,childList:true});new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});schedule();
})();
