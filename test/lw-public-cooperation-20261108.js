/* LW-PUBLIC-03 · Staging cooperation form / protected Owner inbox, multilingual and no public contacts. */
(()=>{"use strict";
const t={
ru:{title:"Предложить сотрудничество",intro:"Для поставщиков товаров и перевозчиков, желающих работать с нашей компанией. Обращение поступит владельцу портала.",kind:"Вы представляете",supplier:"Поставщика товаров",carrier:"Перевозчика",company:"Название компании",contact:"Контактное лицо",companyHint:"Укажите официальное название компании.",contactHint:"Укажите ответственное контактное лицо.",detailsHint:"Укажите действующий email или телефон с кодом страны.",msgHint:"Опишите товары или услуги перевозки, направления и ваше предложение.",details:"Email или телефон для ответа",msg:"Кратко расскажите о компании и предложении",consent:"Согласен на обработку указанных данных исключительно для ответа на обращение.",send:"Отправить предложение",busy:"Отправляем…",sent:"Обращение получено. Номер: ",err:"Не удалось отправить. Повторите попытку.",owner:"Обращения о сотрудничестве",empty:"Новых обращений пока нет",refresh:"Обновить",read:"Прочитано",close:"Завершить",new:"Новое",privacy:"Публичной регистрации нет: решение о доступе принимает владелец портала.",nav:"Обращения партнёров",files:"Приложить готовое предложение",filesHint:"До 3 файлов по 5 МБ: PDF, Word, Excel, изображения или TXT. Никаких шаблонов заполнять не нужно.",tooMany:"Можно прикрепить не более 3 файлов по 5 МБ каждый (суммарно до 12 МБ).",attached:"Приложенные документы",download:"Скачать",loadingFile:"Загрузка файла…"},
en:{title:"Propose cooperation",intro:"For goods suppliers and carriers wishing to work with our company. The portal owner will receive your request.",kind:"I am a",supplier:"Goods supplier",carrier:"Carrier",company:"Company",contact:"Contact person",companyHint:"Use your company name.",contactHint:"Person responsible for cooperation.",detailsHint:"Enter a valid email or phone with country code.",msgHint:"Explain your products, freight services, geography and proposal.",details:"Reply email or phone",msg:"Briefly describe your company and proposal",consent:"I agree that these details are used solely to respond to my request.",send:"Send proposal",busy:"Sending…",sent:"Request received. Reference: ",err:"Could not send. Please retry.",owner:"Cooperation requests",empty:"No new requests yet",refresh:"Refresh",read:"Mark read",close:"Close",new:"New",privacy:"No public registration. Portal access is granted only by the owner.",nav:"Partner requests",files:"Attach proposal files",filesHint:"Up to 3 files of 5 MB each: PDF, Word, Excel, images or TXT. No templates required.",tooMany:"Attach up to 3 files of 5 MB (up to 12 MB total).",attached:"Attached documents",download:"Download",loadingFile:"Downloading…"},
zh:{title:"合作申请",intro:"面向希望与本公司合作的商品供应商及承运商，申请将提交给平台负责人。",kind:"合作身份",supplier:"商品供应商",carrier:"承运商",company:"公司名称",contact:"联系人",companyHint:"填写公司正式名称。",contactHint:"填写合作负责人姓名。",detailsHint:"填写可用邮箱或带国际区号的电话。",msgHint:"说明产品、运输服务、路线和合作方案。",details:"回复邮箱或电话",msg:"简述公司和合作内容",consent:"我同意仅为回复本申请处理所填写的信息。",send:"提交合作申请",busy:"正在提交…",sent:"申请已收到，编号：",err:"提交失败，请重试。",owner:"合作申请",empty:"暂无申请",refresh:"刷新",read:"标记已读",close:"完成",new:"新申请",privacy:"不支持公开注册。平台访问权限仅由所有者批准。",nav:"合作申请",files:"上传合作方案文件",filesHint:"最多 3 份文件，每份不超过 5 MB：PDF、Word、Excel、图片或 TXT，无需填写模板。",tooMany:"最多上传 3 个文件，单个不超过 5 MB，总计不超过 12 MB。",attached:"附件",download:"下载",loadingFile:"正在下载…"}};
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
'<form id="lw-contact-form" class="lw-contact-form" data-task2-csv="1">'+
'<label>'+esc(c.kind)+'<select name="partnerKind" required><option value="supplier">'+esc(c.supplier)+'</option><option value="carrier">'+esc(c.carrier)+'</option></select></label>'+
'<label>'+esc(c.company)+'<input name="company" required minlength="2" maxlength="120" autocomplete="organization"><small class="lw-contact-hint">'+esc(c.companyHint)+'</small></label>'+
'<label>'+esc(c.contact)+'<input name="contactName" required minlength="2" maxlength="120" autocomplete="name"><small class="lw-contact-hint">'+esc(c.contactHint)+'</small></label>'+
'<label>'+esc(c.details)+'<input name="contactDetails" required minlength="5" maxlength="160" autocomplete="off"><small class="lw-contact-hint">'+esc(c.detailsHint)+'</small></label>'+
'<label class="lw-wide">'+esc(c.msg)+'<textarea name="message" required minlength="10" maxlength="1500" rows="4"></textarea><small class="lw-contact-hint">'+esc(c.msgHint)+'</small></label>'+
'<label class="lw-files lw-wide">'+esc(c.files)+'<input type="file" name="attachments" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt" multiple><small class="lw-contact-hint">'+esc(c.filesHint)+'</small></label>'+'<label class="lw-consent lw-wide"><input type="checkbox" name="consent" required><span>'+esc(c.consent)+'</span></label>'+
'<input type="text" name="website" class="lw-trap" tabindex="-1" autocomplete="off" aria-hidden="true">'+
'<button class="lw-submit" type="submit">'+esc(c.send)+'</button><p class="lw-contact-result" role="status" aria-live="polite"></p></form>';
}
async function submit(e){
if(e.target?.id!=="lw-contact-form")return;e.preventDefault();if(formBusy)return;
const form=e.target,c=tr(),fd=new FormData(form),picked=[...(form.elements.namedItem("attachments")?.files||[])];
if(picked.length>3||picked.some(file=>file.size>5*1024*1024||!file.size)||picked.reduce((n,f)=>n+f.size,0)>12*1024*1024){const result=form.querySelector(".lw-contact-result");result.className="lw-contact-result lw-error";result.textContent=c.tooMany;return;}
if(!form.reportValidity())return;
formBusy=true;const button=form.querySelector("button[type=submit]"),result=form.querySelector(".lw-contact-result");
button.disabled=true;button.textContent=c.busy;result.textContent="";
try{
const response=await fetch("/api/partner-inquiries",{method:"POST",cache:"no-store",body:fd});
const json=await response.json().catch(()=>({}));
if(!response.ok||!json.ok)throw Error(json.error||"HTTP "+response.status);
result.className="lw-contact-result lw-ok";result.textContent=c.sent+(json.reference||"—");form.reset();
}catch(err){result.className="lw-contact-result lw-error";result.textContent=c.err+" "+String(err.message||"").slice(0,140)}
finally{formBusy=false;button.disabled=false;button.textContent=c.send;}
}
function ownerHost(){
const role=document.querySelector(".cabinet-app[data-cabinet-role=owner]");
if(!role)return null;
const help=role.querySelector('.cabinet-panel[data-section="overview"]')||role.querySelector('.cabinet-panel[data-section="help"]');if(!help)return null;
let el=help.querySelector("#lw-owner-inquiries");if(!el){el=document.createElement("section");el.id="lw-owner-inquiries";help.prepend(el);}

return el;
}
function drawOwner(){
const el=ownerHost();if(!el)return;const c=tr();
el.innerHTML='<div class="lw-owner-head"><div><h2>'+esc(c.owner)+'</h2><small>Logistics Workspace · staging</small></div><button type="button" data-lw-refresh>'+esc(c.refresh)+'</button></div>'+
(ownerError?'<p class="lw-error">'+esc(ownerError)+'</p>':"")+
(!ownerItems.length?'<p>'+esc(ownerLoading?"…":c.empty)+'</p>':'<div class="lw-owner-list">'+ownerItems.map(i=>
'<article class="lw-inquiry"><div class="lw-inquiry-top"><strong>'+esc(i.company_name)+'</strong><small>'+esc(i.created_at?new Date(i.created_at).toLocaleString(lang()==="zh"?"zh-CN":lang()==="en"?"en-GB":"ru-RU"):"")+'</small></div>'+
'<p><b>'+esc(i.partner_kind==="carrier"?c.carrier:c.supplier)+'</b> · '+esc(i.status==="new"?c.new:i.status==="closed"?c.close:c.read)+'</p>'+
'<p>'+esc(i.contact_name)+' · '+esc(i.contact_details)+'</p><p class="lw-inquiry-text">'+esc(i.message)+'</p>'+(!Array.isArray(i.attachments)||!i.attachments.length?'':'<div class="lw-inquiry-files"><b>'+esc(c.attached)+'</b>'+i.attachments.map(a=>'<button type="button" class="lw-file-download" data-lw-file="'+esc(a.id)+'" data-lw-filename="'+esc(a.name)+'">'+esc(c.download)+': '+esc(a.name)+' ('+Math.ceil(Number(a.size||0)/1024)+' KB)</button>').join('')+'</div>')+
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
async function ownerFile(e){
const b=e.target.closest("[data-lw-file]");if(!b||b.disabled)return;
const id=b.dataset.lwFile,name=b.dataset.lwFilename;if(!/^[a-f0-9-]{36}$/i.test(id))return;
b.disabled=true;const saved=b.textContent;b.textContent=tr().loadingFile;
try{const res=await fetch("/api/partner-inquiries/attachments/"+encodeURIComponent(id),{cache:"no-store"});if(!res.ok)throw Error("HTTP "+res.status);
const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name||"proposal";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}catch(err){ownerError="Файл недоступен: "+String(err.message||err);drawOwner();}
finally{b.disabled=false;b.textContent=saved;}
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
document.addEventListener("click",e=>{if(e.target.closest("[data-lw-refresh]"))void loadOwner();if(e.target.closest("[data-lw-status]"))void ownerAction(e);if(e.target.closest("[data-lw-file]"))void ownerFile(e)});
new MutationObserver(schedule).observe(document.getElementById("root")||document.body,{subtree:true,childList:true});
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
window.addEventListener("hashchange",()=>{if(location.hash==="#help")void loadOwner()});
schedule();
})();
