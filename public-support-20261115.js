/* A separate public support form and private Owner inbox. */
(()=>{'use strict';
const copy={ru:{title:'Поддержка',intro:'Опишите проблему с порталом. Ответ придёт на указанный email или телефон.',name:'Ваше имя',contact:'Email или телефон для ответа',subject:'Тема обращения',message:'Сообщение',consent:'Согласен на обработку указанных данных для ответа на обращение.',send:'Отправить обращение',sending:'Отправка…',sent:'Обращение принято. Номер: ',close:'Закрыть',error:'Не удалось выполнить запрос. Повторите позже.',inbox:'Обращения в поддержку',refresh:'Обновить',more:'Загрузить ещё',empty:'Обращений пока нет',note:'Пояснение владельца',history:'История',new:'Новое',read:'Прочитано',in_progress:'В работе',closed:'Завершено',loading:'Загрузка…'},en:{title:'Support',intro:'Describe your portal issue. We will reply using the email or phone you provide.',name:'Your name',contact:'Reply email or phone',subject:'Subject',message:'Message',consent:'I agree to the use of these details to respond to this request.',send:'Send request',sending:'Sending…',sent:'Request received. Reference: ',close:'Close',error:'Request failed. Please try again later.',inbox:'Support inbox',refresh:'Refresh',more:'Load more',empty:'No requests yet',note:'Owner note',history:'History',new:'New',read:'Read',in_progress:'In progress',closed:'Completed',loading:'Loading…'},zh:{title:'支持',intro:'请描述平台问题。我们将通过您提供的邮箱或电话回复。',name:'您的姓名',contact:'回复邮箱或电话',subject:'主题',message:'消息',consent:'我同意仅为回复本申请处理上述信息。',send:'提交申请',sending:'正在提交…',sent:'申请已收到，编号：',close:'关闭',error:'操作失败，请稍后重试。',inbox:'支持收件箱',refresh:'刷新',more:'加载更多',empty:'暂无申请',note:'负责人说明',history:'历史',new:'新建',read:'已阅',in_progress:'处理中',closed:'已完成',loading:'加载中…'}};
const words=()=>copy[/^zh/i.test(document.documentElement.lang)?'zh':/^en/i.test(document.documentElement.lang)?'en':'ru'];
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
let active=null;
function shell(title){
 if(active){active.focus();return null;}
 const previous=document.activeElement,d=el('dialog',null,{class:'public-support','aria-labelledby':'support-title'}),heading=el('h2',title,{id:'support-title'}),close=el('button',words().close,{type:'button',class:'support-close'});
 close.onclick=()=>d.close();d.addEventListener('close',()=>{active=null;d.remove();if(previous?.isConnected)previous.focus();});d.append(close,heading);document.body.append(d);active=d;d.showModal();return d;
}
function field(form,key,label,options={}){
 const wrap=el('label',label),input=el(options.rows?'textarea':'input',null,{name:key,...options});wrap.append(input);form.append(wrap);return input;
}
async function api(body,offset=0){
 const response=await fetch('/api/support-requests'+(body?'':'?offset='+offset),{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw Error(data.error||words().error);return data;
}
function publicForm(){
 const w=words(),d=shell(w.title);if(!d)return;d.append(el('p',w.intro));
 const form=el('form',null,{'data-task2-csv':'1',id:'public-support-form'});
 field(form,'name',w.name,{required:'',minlength:'2',maxlength:'120',autocomplete:'name'});
 field(form,'contact',w.contact,{required:'',minlength:'5',maxlength:'160',autocomplete:'off'});
 field(form,'subject',w.subject,{required:'',minlength:'3',maxlength:'160'});
 field(form,'message',w.message,{required:'',minlength:'10',maxlength:'5000',rows:'5'});
 const consent=el('label',null,{class:'support-consent'}),checkbox=el('input',null,{name:'consent',type:'checkbox',required:''});consent.append(checkbox,el('span',w.consent));form.append(consent);
 form.append(el('input',null,{name:'website',type:'text',class:'support-trap',tabindex:'-1',autocomplete:'off','aria-hidden':'true'}));
 const send=el('button',w.send,{type:'submit'}),status=el('p','',{role:'status','aria-live':'polite',class:'support-result'});form.append(send,status);d.append(form);
 let busy=false,pendingSignature='',pendingId='';
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const fd=new FormData(form),body={action:'create',name:fd.get('name'),contact:fd.get('contact'),subject:fd.get('subject'),message:fd.get('message'),consent:checkbox.checked,website:fd.get('website')},signature=JSON.stringify(body);
  if(signature!==pendingSignature){pendingSignature=signature;pendingId=crypto.randomUUID();}body.requestId=pendingId;
  busy=true;send.disabled=true;send.textContent=w.sending;status.textContent='';
  try{const data=await api(body);status.textContent=w.sent+data.reference;status.className='support-result support-success';form.reset();pendingSignature='';pendingId='';}
  catch(error){status.textContent=error.message;status.className='support-result support-error';}
  finally{busy=false;send.disabled=false;send.textContent=w.send;}
 };
}
async function inbox(){
 if(!owner())return;const w=words(),d=shell(w.inbox);if(!d)return;
 const refresh=el('button',w.refresh,{type:'button'}),status=el('p','',{role:'status'}),list=el('div',null,{class:'support-inbox'}),more=el('button',w.more,{type:'button'});d.append(refresh,status,list,more);
 let items=[],offset=0,busy=false;
 async function load(reset){
  if(busy||!owner())return;busy=true;refresh.disabled=true;more.disabled=true;status.textContent=w.loading;
  try{const data=await api(null,reset?0:offset);if(!owner()){d.close();return;}items=reset?data.items:items.concat(data.items);offset=data.nextOffset;more.hidden=!data.hasMore;draw();status.textContent='';}
  catch(error){status.textContent=error.message;}finally{busy=false;refresh.disabled=false;more.disabled=false;}
 }
 function draw(){
  list.replaceChildren();if(!items.length)list.append(el('p',w.empty));
  for(const item of items){
   const card=el('article'),details=el('details'),summary=el('summary',item.subject+' · '+(w[item.status]||item.status));details.append(summary,el('small',item.id+' · '+new Date(item.created_at).toLocaleString()),el('p',item.contact_name+' · '+item.contact_details),el('p',item.message,{class:'support-message'}));
   const noteLabel=el('label',w.note),note=el('textarea',null,{rows:'2',maxlength:'2000'});note.value=item.owner_note||'';noteLabel.append(note);details.append(noteLabel);
   const transitions={new:['read','in_progress'],read:['in_progress','closed'],in_progress:['closed'],closed:['in_progress']};
   for(const next of transitions[item.status]||[]){const button=el('button',w[next],{type:'button'});button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;try{await api({action:'set_status',id:item.id,expectedStatus:item.status,status:next,note:note.value});busy=false;await load(true);}catch(error){status.textContent=error.message;}finally{busy=false;button.disabled=false;}};details.append(button);}
   const history=el('details'),events=el('ul');history.append(el('summary',w.history));for(const event of item.history||[])events.append(el('li',(w[event.status]||event.status)+' · '+new Date(event.at).toLocaleString()+(event.note?' · '+event.note:'')));history.append(events);details.append(history);card.append(details);list.append(card);
  }
 }
 refresh.onclick=()=>load(true);more.onclick=()=>load(false);await load(true);
}
document.addEventListener('click',event=>{if(event.target.closest('[data-lw-support]')){event.preventDefault();event.stopImmediatePropagation();publicForm();}},true);
let queued=false;function sync(){queued=false;const login=document.querySelector('.cycle-landing .cycle-login');let entry=document.getElementById('public-support-entry');if(login){if(!entry){entry=el('button',words().title,{id:'public-support-entry',type:'button','data-lw-support':''});login.append(entry);}if(entry.textContent!==words().title)entry.textContent=words().title;}else entry?.remove();const cab=owner(),existing=document.getElementById('owner-support-inbox');if(!cab){existing?.remove();if(active?.querySelector('.support-inbox'))active.close();return;}if(existing){if(existing.textContent!==words().inbox)existing.textContent=words().inbox;return;}const target=cab.querySelector('.cabinet-sidebar nav')||cab.querySelector('.cabinet-sidebar');if(target){const button=el('button',words().inbox,{id:'owner-support-inbox',type:'button'});button.onclick=inbox;target.append(button);}}
new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(sync);}}).observe(document.body,{childList:true,subtree:true});new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sync();
})();
