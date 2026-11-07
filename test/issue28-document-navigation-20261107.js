/* Issue #28 staging: show independent document/execution navigation in the document workspace. */
(() => {
  "use strict";
  const N="issue28-document-process-navigation";
  const labels={
    ru:{document:"Транспортные заявки",docInfo:"Подготовка, согласование и исправления документа",execution:"Исполнение перевозок",execInfo:"Этапы, трекинг, документы исполнения и закрытие"},
    en:{document:"Transport applications",docInfo:"Prepare, submit and approve the transport document",execution:"Shipment execution",execInfo:"Stages, tracking, execution files and closure"},
    zh:{document:"运输委托书",docInfo:"准备、提交和审批运输文件",execution:"运输执行",execInfo:"运输阶段、追踪、执行文件及完结"}
  };
  const l=()=>labels[(document.documentElement.lang||"ru").slice(0,2)]||labels.ru;
  function updateMenu(){
    document.querySelectorAll('a[href="#transport-applications"],button[data-section="transport-applications"]').forEach(el=>{
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(node.nodeValue.includes("Транспортная заявка · документ"))node.nodeValue=node.nodeValue.replaceAll("Транспортная заявка · документ",l().document);
      }
    });
  }
  function mount(){
    updateMenu();
    const pane=document.querySelector('.cabinet-panel[data-section="transport-applications"]');
    if(!pane||pane.querySelector("#"+N))return;
    const nav=document.createElement("nav");
    nav.id=N;
    nav.className="issue28-document-process-nav";
    nav.setAttribute("aria-label",l().document+" / "+l().execution);
    const first=document.createElement("a"),second=document.createElement("a");
    first.className="issue28-process-tile is-current";first.href="#transport-applications";first.setAttribute("aria-current","page");
    second.className="issue28-process-tile";second.href="#approved-shipments";
    for(const [a,title,info] of [[first,l().document,l().docInfo],[second,l().execution,l().execInfo]]){
      const strong=document.createElement("strong"),span=document.createElement("span");
      strong.textContent=title;span.textContent=info;a.append(strong,span);
    }
    nav.append(first,second);
    pane.prepend(nav);
  }
  let scheduled=false;
  const mo=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;mount();});
  });
  mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["lang"]});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});
  else mount();
})();
