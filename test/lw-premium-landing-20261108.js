
/* LW-PUBLIC-01: Staging-only DOM enhancements; no replacement of React auth handlers. */
(()=>{
 const TEXT={
 ru:{brand:"Портал поставок и логистики",eyebrow:"РАБОЧЕЕ ПРОСТРАНСТВО ДЛЯ ПАРТНЁРОВ",lead:"Единая рабочая среда для поставщиков товаров, перевозчиков и внутренних отделов. Заказы, документы и координация поставок — в одном защищённом пространстве.",partner:"Стать партнёром",hint:"Сотрудничество с поставщиками и перевозчиками",partnerTitle:"Предложить сотрудничество",partnerInfo:"Logistics Workspace — закрытый рабочий портал. Подключение новых поставщиков и перевозчиков согласовывается с владельцем системы. Для обсуждения сотрудничества обратитесь к представителю компании по действующему каналу связи. Самостоятельная регистрация пока недоступна.",stripe:["Поставщики товаров","Перевозчики","Документы","Внутренние отделы"]},
 en:{brand:"Supply and logistics portal",eyebrow:"WORKSPACE FOR PARTNERS",lead:"One secure workspace for goods suppliers, carriers and internal teams. Orders, documents and supply coordination are brought together in one place.",partner:"Become a partner",hint:"Work with suppliers and carriers",partnerTitle:"Explore a partnership",partnerInfo:"Logistics Workspace is a private business portal. The portal owner approves access for new suppliers and carriers. Please contact your company representative through your existing business channel to discuss cooperation. Self-registration is not available yet.",stripe:["Goods suppliers","Carriers","Documents","Internal teams"]},
 zh:{brand:"供应与物流协作门户",eyebrow:"合作伙伴工作空间",lead:"为商品供应商、承运商和内部团队提供统一、安全的工作空间，在同一平台协调订单、文件与供货流程。",partner:"成为合作伙伴",hint:"供应商与承运商合作",partnerTitle:"洽谈合作",partnerInfo:"Logistics Workspace 是封闭的工作平台。新供应商与承运商的接入由平台所有者审批。合作事宜请通过现有商务渠道联系公司负责人，目前不提供自行注册。",stripe:["商品供应商","承运商","文件","内部团队"]}
 };
 let scheduled=false;
 function locale(){const l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("zh")?"zh":l.startsWith("en")?"en":"ru"}
 function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
 function sync(){
  const root=document.querySelector(".cycle-landing");if(!root)return;
  const l=locale(),t=TEXT[l],hero=root.querySelector(".cycle-hero");if(!hero)return;
  const brand=root.querySelector(".cycle-brand > div");
  if(brand){const text=Array.from(brand.childNodes).find(n=>n.nodeType===3);if(text&&text.nodeValue!=="Logistics Workspace")text.nodeValue="Logistics Workspace";setText(brand.querySelector("small"),t.brand)}
  const heroTitle=hero.querySelector(".cycle-intro h1"), expected="LogisticsWorkspace";
  if(heroTitle&&heroTitle.textContent.replace(/\s/g,"")!==expected)heroTitle.innerHTML="<span>Logistics</span><span>Workspace</span>";
  const eyebrow=hero.querySelector(".cycle-eyebrow");
  if(eyebrow){let label=eyebrow.querySelector(".lw-eyebrow-label");if(!label){Array.from(eyebrow.childNodes).filter(n=>n.nodeType===3).forEach(n=>n.remove());label=document.createElement("span");label.className="lw-eyebrow-label";eyebrow.appendChild(label)}setText(label,t.eyebrow)}
  setText(hero.querySelector(".cycle-lead"),t.lead);
  const links=hero.querySelector(".cycle-hero-links");
  if(links){
   let a=links.querySelector(".lw-partner-cta");if(!a){a=document.createElement("a");a.className="lw-partner-cta";a.href="#lw-partners";links.appendChild(a)}setText(a,t.partner);
   let hint=links.querySelector(".lw-partner-hint");if(!hint){hint=document.createElement("span");hint.className="lw-partner-hint";links.appendChild(hint)}setText(hint,t.hint);
  }
  if(!hero.querySelector(".lw-globe")){const g=document.createElement("div");g.className="lw-globe";g.setAttribute("aria-hidden","true");hero.insertBefore(g,hero.querySelector(".cycle-login")||null)}
  hero.querySelectorAll(".cycle-stage-strip > div b").forEach((n,i)=>{if(t.stripe[i])setText(n,t.stripe[i])});
  let partners=root.querySelector("#lw-partners");
  if(!partners){partners=document.createElement("section");partners.id="lw-partners";partners.className="lw-partners";partners.innerHTML='<div><h2></h2><p></p></div><div class="lw-partner-mark" aria-hidden="true">↗</div>';hero.after(partners)}
  if(!partners.querySelector("#lw-contact-form")){setText(partners.querySelector("h2"),t.partnerTitle);setText(partners.querySelector("p"),t.partnerInfo);}
  root.setAttribute("data-lw-public","20261108");
 }
 function request(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync()})}
 const target=document.getElementById("root")||document.body;
 new MutationObserver(request).observe(target,{childList:true,subtree:true});
 new MutationObserver(request).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
 request();
})();
