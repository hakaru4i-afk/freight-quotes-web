/* LW-PUBLIC-03 · Staging cooperation form / protected Owner inbox, multilingual and no public contacts. */
(()=>{"use strict";
const t={
ru:{title:"Предложить сотрудничество",intro:"Для поставщиков товаров и перевозчиков, желающих работать с нашей компанией. Обращение поступит владельцу портала.",kind:"Вы представляете",supplier:"Поставщика товаров",carrier:"Перевозчика",company:"Название компании",contact:"Контактное лицо",details:"Email или телефон для ответа",msg:"Кратко расскажите о компании и предложении",consent:"Согласен на обработку указанных данных исключительно для ответа на обращение.",send:"Отправить предложение",busy:"Отправляем…",sent:"Обращение получено. Номер: ",err:"Не удалось отправить. Повторите попытку.",owner:"Обращения о сотрудничестве",empty:"Новых обращений пока нет",refresh:"Обновить",read:"Прочитано",close:"Завершить",new:"Новое",privacy:"Публичной регистрации нет: решение о доступе принимает владелец портала.",nav:"Обращения партнёров"},
en:{title:"Propose cooperation",intro:"For goods suppliers and carriers wishing to work with our company. The portal owner will receive your request.",kind:"I am a",supplier:"Goods supplier",carrier:"Carrier",company:"Company",contact:"Contact person",details:"Reply email or phone",msg:"Briefly describe your company and proposal",consent:"I agree that these details are used solely to respond to my request.",send:"Send proposal",busy:"Sending…",sent:"Request received. Reference: ",err:"Could not send. Please retry.",owner:"Cooperation requests",empty:"No new requests yet",refresh:"Refresh",read:"Mark read",close:"Close",new:"New",privacy:"No public registration. Portal access is granted only by the owner.",nav:"Partner requests"},
zh:{title:"合作申请",intro:"面向希望与本公司合作的商品供应商及承运商，申请将提交给平台负责人。",kind:"合作身份",supplier:"商品供应商",carrier:"承运商",company:"公司名称",contact:"联系人",details:"回复邮箱或电话",msg:"简述公司和合作内容",consent:"我同意仅为回复本申请处理所填写的信息。",send:"提交合作申请",busy:"正在提交…",sent:"申请已收到，编号：",err:"提交失败，请重试。",owner:"合作申请",empty:"暂无申请",refresh:"刷新",read:"标记已读",close:"完成",new:"新申请",privacy:"不支持公开注册。平台访问权限仅由所有者批准。",nav:"合作申请"}};
const lang=()=>{let l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("zh")?"zh":l.startsWith("en")?"en":"ru"};
const tr=()=>t[lang()];
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
let formBusy=false,ownerBusy=false,ownerItems=[],ownerLoaded=false,ownerError="",ownerLoading=false,pending=false;
function publicForm(){
const landing=document.querySelector(".cycle-landing"),host=document.querySelector("#lw-partners");if(!landing||!host)return;
const l=lang(),c=tr();
if(host.dataset.language===l&&host.querySelector("#lw-contact-form"))return;
host.dataset.language=l;
host.innerHTML='<div class="lw-contact-copy"><h2>'+esc(c.title)+'</h2><p>'+esc(c.intro)+'</p><p class="lw-contact-privacy">'+esc(c.privacy)+'</p></div>'+
'<form id="lw-contact-form" class="lw-contact-form">'+
'<label>'+esc(c.kind)+'<select name="partnerKind" required><option value="supplier">'+esc(c.supplier)+'</option><option value="carrier">'+esc(c.carrier)+'</option></select></label>'+
'<label>'+esc(c.company)+'<input name="company" required minlength="2" maxlength="120" autocomplete="organization"></label>'+
'<label>'+esc(c.contact)+'<input name="contactName" required minlength="2" maxlength="120" autocomplete="name"></label>'+
'<label>'+esc(c.details)+'<input name="contactDetails" required minlength="5" maxlength="160" autocomplete="email"></label>'+
'<label class="lw-wide">'+esc(c.msg)+'<textarea name="message" required minlength="10" maxlength="1500" rows="4"></textarea></label>'+
'<label class="lw-consent lw-wide"><input type="checkbox" name="consent" required><span>'+esc(c.consent)+'</span></label>'+
'<input type="text" name="website" class="lw-trap" tabindex="-1" autocomplete="off" aria-hidden="true">'+
'<button class="lw-submit" type="submit">'+esc(c.send)+'</button><p class="lw-contact-result" role="status" aria-live="polite"></p></form>';
}
async function submit(e){
if(e.target?.id!=="lw-contact-form")return;e.preventDefault();if(formBusy)return;
const form=e.target,c=tr(),fd=new FormData(form),b=Object.fromEntries(fd.entries());
if(!form.reportValidity())return;
formBusy=true;const button=form.querySelector("button[type=submit]"),result=form.querySelector(".lw-contact-result");
button.disabled=true;button.textContent=c.busy;result.textContent="";
try{
const response=await fetch("/api/partner-inquiries",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({partnerKind:b.partnerKind,company:b.company,contactName:b.contactName,contactDetails:b.contactDetails,message:b.message,consent:b.consent==="on",website:b.website||""})});
const json=await response.json().catch(()=>({}));
if(!response.ok||!json.ok)throw Error(json.error||"HTTP "+response.status);
result.className="lw-contact-result lw-ok";result.textContent=c.sent+(json.reference||"—");form.reset();
}catch(err){result.className="lw-contact-result lw-error";result.textContent=c.err+" "+String(err.message||"").slice(0,140)}
finally{formBusy=false;button.disabled=false;button.textContent=c.send;}
}
function ownerHost(){
const role=document.querySelector(".cabinet-app[data-cabinet-role=owner]");
if(!role)return null;
const help=role.querySelector('.cabinet-panel[data-section="help"]');if(!help)return null;
let el=help.querySelector("#lw-owner-inquiries");if(!el){el=document.createElement("section");el.id="lw-owner-inquiries";help.prepend(el);}
const nav=role.querySelector(".cabinet-sidebar nav");
if(nav&&!nav.querySelector(".lw-inbox-nav")){const a=document.createElement("a");a.className="lw-inbox-nav";a.href="#help";a.textContent="✉ "+tr().nav;a.addEventListener("click",()=>{setTimeout(()=>{document.getElementById("lw-owner-inquiries")?.scrollIntoView({block:"start",behavior:"smooth"});void loadOwner()},220)});nav.append(a)}
return el;
}
function drawOwner(){
const el=ownerHost();if(!el)return;const c=tr();
el.innerHTML='<div class="lw-owner-head"><div><h2>'+esc(c.owner)+'</h2><small>Logistics Workspace · staging</small></div><button type="button" data-lw-refresh>'+esc(c.refresh)+'</button></div>'+
(ownerError?'<p class="lw-error">'+esc(ownerError)+'</p>':"")+
(!ownerItems.length?'<p>'+esc(ownerLoading?"…":c.empty)+'</p>':'<div class="lw-owner-list">'+ownerItems.map(i=>
'<article class="lw-inquiry"><div class="lw-inquiry-top"><strong>'+esc(i.company_name)+'</strong><small>'+esc(i.created_at?new Date(i.created_at).toLocaleString(lang()==="zh"?"zh-CN":lang()==="en"?"en-GB":"ru-RU"):"")+'</small></div>'+
'<p><b>'+esc(i.partner_kind==="carrier"?c.carrier:c.supplier)+'</b> · '+esc(i.status==="new"?c.new:i.status==="closed"?c.close:c.read)+'</p>'+
'<p>'+esc(i.contact_name)+' · '+esc(i.contact_details)+'</p><p class="lw-inquiry-text">'+esc(i.message)+'</p>'+
(i.status!=="closed"?'<div class="lw-inquiry-actions">'+(i.status==="new"?'<button type="button" data-lw-status="read" data-lw-id="'+esc(i.id)+'">'+esc(c.read)+'</button>':"")+'<button type="button" data-lw-status="closed" data-lw-id="'+esc(i.id)+'">'+esc(c.close)+'</button></div>':"")+'</article>').join("")+'</div>');
}
async function loadOwner(){
if(!ownerHost()||ownerLoading||ownerBusy)return;ownerLoading=true;
try{const response=await fetch("/api/partner-inquiries",{cache:"no-store"}),json=await response.json();if(!response.ok||!json.ok)throw Error("HTTP "+response.status);ownerItems=Array.isArray(json.items)?json.items:[];ownerLoaded=true;ownerError="";}
catch(e){ownerError="Обращения временно недоступны: "+e.message}
finally{ownerLoading=false;drawOwner()}
}
async function ownerAction(e){
const b=e.target.closest("[data-lw-status]");if(!b||ownerBusy)return;
ownerBusy=true;b.disabled=true;try{
const r=await fetch("/api/partner-inquiries",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:b.dataset.lwId,status:b.dataset.lwStatus})}),j=await r.json();if(!r.ok||!j.ok)throw Error("HTTP "+r.status);
ownerBusy=false;await loadOwner();
}catch(x){ownerError=x.message;drawOwner()}
finally{ownerBusy=false;}
}
let lastLang="";
function mount(){
publicForm();
const host=ownerHost();
if(host){if(lastLang!==lang()&&ownerLoaded)drawOwner();else if(!host.querySelector(".lw-owner-head"))drawOwner();
if(!ownerLoaded&&!ownerLoading&&!ownerError)void loadOwner();}
lastLang=lang();
}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;mount()})}
document.addEventListener("submit",submit);
document.addEventListener("click",e=>{if(e.target.closest("[data-lw-refresh]"))void loadOwner();if(e.target.closest("[data-lw-status]"))void ownerAction(e)});
new MutationObserver(schedule).observe(document.getElementById("root")||document.body,{subtree:true,childList:true});
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
window.addEventListener("hashchange",()=>{if(location.hash==="#help")void loadOwner()});
schedule();
})();
