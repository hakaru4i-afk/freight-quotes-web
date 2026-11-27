/* OW-USERS-20261117: 7 Owner-created cabinets and independently protected deletion. */
(()=>{"use strict";
if(window.__owUsers20261117)return;window.__owUsers20261117=true;
const tr={
ru:{retry:"Повторить",roleUnavailable:"Справочник ролей недоступен",carrier:"Создать перевозчика",supplier:"Создать поставщика",purchasing:"Создать сотрудника закупок",certification:"Создать сотрудника сертификации",logistic:"Создать сотрудника ВЭД",designer:"Создать дизайнера",content:"Создать контент-менеджера",remove:"Удалить пользователя",login:"Логин",name:"Имя сотрудника",password:"Пароль (от 12 символов)",create:"Создать сотрудника",cancel:"Отмена",save:"Создать",delete:"Удалить учётную запись",select:"Выберите пользователя",confirm:"Повторите точный логин для удаления",warning:"Удаление отзывает сессии, но история заявок и документов сохраняется. Аккаунты с обязательными связями защищены.",successCreate:"Пользователь создан",successDelete:"Пользователь удалён",failed:"Ошибка",busy:"Выполнение…",note:"Дизайнер и контент-менеджер — отдельные роли.",vedNote:"ВЭД (роль logistic): только выигравшие перевозки, документы, задачи перед ПТО и чаты; без ранних ставок и чужих заявок.",newRights:"Сотрудник создаётся с ролью кабинета; дополнительные права владелец назначит отдельно."},
en:{retry:"Retry",roleUnavailable:"The role catalog is unavailable",carrier:"Create carrier",supplier:"Create supplier",purchasing:"Create purchasing employee",certification:"Create certification employee",logistic:"Create foreign-trade employee",designer:"Create designer",content:"Create content manager",remove:"Delete user",login:"Login",name:"Full name",password:"Password (12+ characters)",create:"Create employee",cancel:"Cancel",save:"Create",delete:"Delete account",select:"Select user",confirm:"Retype the exact login to delete",warning:"Deletion revokes sessions and preserves shipment/document history. Accounts with linked records are protected.",successCreate:"User created",successDelete:"User deleted",failed:"Error",busy:"Saving…",note:"Designer and content manager are distinct.",vedNote:"Foreign trade (logistic role): only winning shipments, documents, pre-customs tasks and chats; no early bids.",newRights:"Create the cabinet now; the Owner can assign additional permissions later."},
zh:{retry:"重试",roleUnavailable:"无法获取角色列表",carrier:"创建承运商",supplier:"创建供应商",purchasing:"创建采购员工",certification:"创建认证员工",logistic:"创建外贸员工",designer:"创建设计师",content:"创建内容经理",remove:"删除用户",login:"用户名",name:"姓名",password:"密码（至少12位）",create:"创建员工",cancel:"取消",save:"创建",delete:"删除账号",select:"选择用户",confirm:"重新输入准确用户名以确认删除",warning:"删除会撤销会话并保留运输和文件记录；有关联记录的账号受到保护。",successCreate:"用户已创建",successDelete:"用户已删除",failed:"错误",busy:"正在保存…",note:"设计师和内容经理是独立角色。",vedNote:"外贸（logistic）：仅获胜运单、文件、清关前任务和聊天；不显示早期报价。",newRights:"先创建账号，其他权限由所有者稍后授予。"}
};
const locale=()=>{const l=(document.documentElement.lang||"ru").toLowerCase();return tr[l.slice(0,2)]||tr.ru};
const el=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==="class")node.className=v;else if(k==="type")node.type=v;else node.setAttribute(k,v)}if(text!=null)node.textContent=text;return node};
const api=async payload=>{const res=await fetch("/api/team",payload?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"}:{cache:"no-store"});const data=await res.json().catch(()=>({}));if(!res.ok||data.error)throw new Error(data.error||"HTTP "+res.status);return data};
function ownerTeam(){
 const owner=document.querySelector('#root .cabinet-app[data-cabinet-role="owner"],#root .staff-portal[data-cabinet-role="owner"]');
 if(!owner)return null;
 const area=owner.querySelector('.cabinet-panel[data-section="team"]');
 if(!area)return null;
 const h=[...area.querySelectorAll("h1,h2,h3")].find(e=>/пользователи\s+и\s+права|users\s+(?:and|&)\s+rights|用户/.test((e.textContent||"").trim().toLowerCase()));
 // Wait for the real People & Rights card. Never mount controls on the outer team panel.
 return h?.closest("section.card")||null;
}
function dialog(mode,role){
 const t=locale(),bg=el("div",{class:"ow-users-backdrop",role:"presentation"}),form=el("form",{class:"ow-users-dialog",role:"dialog","aria-modal":"true","aria-label":mode==="delete"?t.delete:t.create});
 const title=el("h3",{},mode==="delete"?t.delete:(Object.hasOwn(t,role)?t[role]:t.create));
 const note=el("p",{class:"ow-users-note"},mode==="delete"?t.warning:role==="logistic"?t.vedNote:["purchasing","certification"].includes(role)?t.newRights:t.note);
 form.append(title,note);let login,pass,name,sel;
 const field=(label,input)=>{const wrap=el("label",{class:"ow-users-field"});wrap.append(el("span",{},label),input);form.append(wrap);for(const [key,value] of [["color","#142b43"],["-webkit-text-fill-color","#142b43"],["background-color","#ffffff"],["caret-color","#142b43"],["color-scheme","light"]])input.style.setProperty(key,value,"important");return input};
 if(mode==="delete"){
  sel=field(t.select,el("select",{required:"required"}));sel.append(el("option",{value:""},t.select));
  const opt=()=>api().then(data=>{
   for(const m of (data.members||[])){const l=String(m.email||"");if(!l||m.role==="owner")continue;sel.append(el("option",{value:l},(m.name||l)+" · "+l+" · "+(m.role==="logistic"?"ВЭД":m.role||"")))}
  });
  opt().catch(err=>{status.textContent=err.message});
  login=field(t.confirm,el("input",{required:"required",autocomplete:"off",spellcheck:"false"}));
 }else{
  login=field(t.login,el("input",{required:"required",minlength:"3",maxlength:"60",pattern:"[a-z0-9._-]{3,60}",autocomplete:"off",spellcheck:"false"}));
  name=field(t.name,el("input",{maxlength:"120",autocomplete:"off"}));
  pass=field(t.password,el("input",{type:"password",required:"required",minlength:"12",autocomplete:"new-password"}));
 }
 const status=el("p",{class:"ow-users-result",role:"status","aria-live":"polite"});
 const controls=el("div",{class:"ow-users-dialog-actions"});
 const cancel=el("button",{type:"button",class:"ow-users-secondary"},t.cancel);
 const save=el("button",{type:"submit",class:"ow-users-primary"},mode==="delete"?t.delete:t.save);
 controls.append(cancel,save);form.append(status,controls);bg.append(form);document.body.append(bg);
 const close=()=>bg.remove();cancel.addEventListener("click",close);bg.addEventListener("click",e=>{if(e.target===bg)close()});
 const onEscape=e=>{if(e.key==="Escape"){close();document.removeEventListener("keydown",onEscape)}};document.addEventListener("keydown",onEscape,{once:true});
 form.addEventListener("submit",async e=>{e.preventDefault();status.textContent="";save.disabled=true;save.textContent=t.busy;
  try{
   if(mode==="delete"){const selected=sel.value,typed=login.value.trim().toLowerCase();if(!selected||selected!==typed)throw Error(t.confirm);await api({action:"delete",email:selected,confirmLogin:typed});status.textContent=t.successDelete}
   else{const l=login.value.trim().toLowerCase();if(!/^[a-z0-9._-]{3,60}$/.test(l)||pass.value.length<12)throw Error(t.login+" / "+t.password);await api({action:"add",role,email:l,name:name.value.trim(),password:pass.value});pass.value="";status.textContent=t.successCreate}
   document.dispatchEvent(new Event("ow-users-changed"));setTimeout(close,700);
  }catch(err){status.textContent=t.failed+": "+(err.message||String(err));save.disabled=false;save.textContent=mode==="delete"?t.delete:t.save}
 });
 login.focus();
}
function apply(){
 const panel=ownerTeam();if(!panel)return;
 const area=panel.closest('.cabinet-panel[data-section="team"]');
 // React may render the card later. Remove any earlier/floating action sets, retaining one canonical set.
 const sets=[...(area?.querySelectorAll(".ow-users-actions")||[])];
 const canonical=sets.find(node=>node.parentElement===panel);
 for(const node of sets)if(node!==canonical)node.remove();
 if(canonical)return;
 const t=locale(),wrap=el("div",{class:"ow-users-actions","data-ow-users-version":"OW-20261117"});
 const del=el("button",{type:"button",class:"ow-users-action ow-users-delete"},t.remove);del.addEventListener("click",()=>dialog("delete"));wrap.append(del);
 const header=panel.querySelector("h1,h2,h3");if(header)header.insertAdjacentElement("afterend",wrap);else panel.prepend(wrap);
 const roleNote=[...panel.querySelectorAll("p.small")].find(p=>(p.textContent||"").includes("Логист / сотрудник ВЭД видит все предложения"));
 if(roleNote)roleNote.textContent="ВЭД: только победившие перевозки, проверка документов перед ПТО, назначенные задачи и чат по заявке; ранние ставки и чужие перевозки недоступны.";

 // Do not show a second native button with the same action, especially Supplier.
 const legacyCreate=/^(?:Создать дизайнера\s*\/\s*контент-менеджера|Create designer\s*\/\s*content manager)$/i;
 for(const btn of panel.querySelectorAll("button")){
  if(wrap.contains(btn))continue;
  const value=(btn.textContent||"").trim();
  if(value===t.supplier||legacyCreate.test(value)){
   btn.classList.add("ow-users-native-duplicate");btn.hidden=true;btn.style.display="none";
  }
 }
 const status=el("p",{role:"status","aria-live":"polite"});
 const retry=el("button",{type:"button",class:"ow-users-action",hidden:"hidden"},t.retry);
 wrap.prepend(status,retry);
 const loadRoles=async()=>{
  status.textContent=t.busy;retry.hidden=true;
  try{
   const {creatableRoles}=await api();
   if(!Array.isArray(creatableRoles)||!creatableRoles.length||new Set(creatableRoles).size!==creatableRoles.length||
      creatableRoles.some(role=>typeof role!=="string"||!/^[a-z][a-z0-9_-]*$/.test(role)))throw Error(t.roleUnavailable);
   for(const role of creatableRoles){
    const label=Object.hasOwn(t,role)?t[role]:role;
    const button=el("button",{type:"button",class:"ow-users-action ow-users-create","data-user-role":role},label);
    button.addEventListener("click",()=>dialog("add",role));wrap.insertBefore(button,del);
   }
   status.remove();retry.remove();
  }catch(err){status.textContent=t.failed+": "+err.message;retry.hidden=false}
 };
 retry.addEventListener("click",loadRoles);void loadRoles();
}
let scheduled=false;
const scan=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}};
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scan,{once:true});else scan();
})();
