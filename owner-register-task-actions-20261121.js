/* Owner register task actions. Server is authoritative; client never supplies progress or GitHub tokens. */
(()=>{'use strict';
 const REGISTERS=new Set(['remarks','developments','updates']),DRAFTS=new Map();
 const WORDS=[
  {deadline:'Плановый дедлайн',start:'Запустить в разработку',postpone:'Отложить',reject:'Отклонить',reason:'Причина решения',placeholder:'Укажите причину (минимум 10 символов)',apply:'Подтвердить',cancel:'Отмена',progress:'Прогресс выполнения',missingDate:'Укажите плановый дедлайн.',missingReason:'Укажите причину не менее 10 символов.',notice:'Статус и прогресс подтверждаются сервером и GitHub.',working:'В разработке',pending:'Ожидает GitHub',retry:'Повторить отправку в GitHub',review:'Отправить на приёмку Владельцу',accept:'Принять',rejectReview:'Отклонить приёмку',reviewTitle:'Приёмка владельцем',error:'Не удалось сохранить решение',done:'Решение принято сервером',closed:'Историческая или завершённая запись',step:'Стадия: '},
  {deadline:'Planned deadline',start:'Start development',postpone:'Defer',reject:'Reject',reason:'Decision reason',placeholder:'At least 10 characters',apply:'Confirm',cancel:'Cancel',progress:'Task progress',missingDate:'Choose a planned deadline.',missingReason:'Reason must contain at least 10 characters.',notice:'Progress is verified by the server and GitHub.',working:'In development',pending:'Waiting for GitHub',retry:'Retry GitHub dispatch',review:'Submit for Owner review',accept:'Accept',rejectReview:'Reject review',reviewTitle:'Owner review',error:'Could not save decision',done:'Decision saved by server',closed:'Historical or completed record',step:'Stage: '},
  {deadline:'计划截止日期',start:'开始开发',postpone:'延期',reject:'拒绝',reason:'决定理由',placeholder:'至少10个字符',apply:'确认',cancel:'取消',progress:'任务进度',missingDate:'请填写计划截止日期。',missingReason:'原因至少10个字符。',notice:'状态和进度由服务器与 GitHub 验证。',working:'开发中',pending:'等待 GitHub',retry:'重试发送到 GitHub',review:'提交所有者验收',accept:'接受',rejectReview:'拒绝验收',reviewTitle:'所有者验收',error:'保存失败',done:'服务器已保存',closed:'历史或已完成记录',step:'阶段：'}
 ];
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const locale=()=>/^zh/i.test(document.documentElement.lang)?2:/^en/i.test(document.documentElement.lang)?1:0;
 const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
 function render({register,row,job,state,execution,onAction}={}){
  if(!REGISTERS.has(register)||!row?.id)throw Error('REGISTER_TASK_INVALID');
  const w=WORDS[locale()],key=register+':'+row.id;
  let draft=DRAFTS.get(key);
  if(!draft){draft={deadline:date(execution?.deadline||row.deadline||row.plannedDate),reason:''};DRAFTS.set(key,draft);}
  else if(execution?.deadline)draft.deadline=date(execution.deadline);
  const locked=Boolean(row.historyOnly||row.archived||['published','production_verified','accepted','rejected'].includes(state)||['completed','denied'].includes(job?.status)||['accepted','rejected'].includes(execution?.decision));
  const busy=Boolean(execution?.decision==='in_progress'||execution?.decision==='review_pending'||job?.status==='release'||job?.status==='in_progress');
  const root=make('section','ow-task-universal');root.dataset.sharedTaskControls='stage2';root.dataset.register=register;
  const deadlineLabel=make('label','ow-task-deadline');deadlineLabel.append(make('span','ow-task-field-name',w.deadline));
  const deadline=make('input','ow-task-deadline-input');deadline.type='date';deadline.required=true;deadline.value=draft.deadline;deadline.disabled=locked||busy;deadline.setAttribute('aria-label',w.deadline);
  deadline.oninput=()=>{draft.deadline=deadline.value;info.hidden=true;};deadlineLabel.append(deadline);root.append(deadlineLabel);
  const controls=make('div','ow-task-buttons');
  const button=(label,cls)=>{const e=make('button','ow-task-btn ow-task-btn-'+cls,label);e.type='button';e.disabled=locked||busy;return e;};
  const start=button(w.start,'start'),postpone=button(w.postpone,'postpone'),reject=button(w.reject,'reject');
  controls.append(start,postpone,reject);root.append(controls);
  const reasonPanel=make('div','ow-task-reason');reasonPanel.hidden=true;const reasonLabel=make('label','ow-task-reason-label');reasonLabel.append(make('span',null,w.reason));
  const textarea=make('textarea','ow-task-reason-textarea');textarea.rows=3;textarea.maxLength=1000;textarea.placeholder=w.placeholder;textarea.value=draft.reason;
  reasonLabel.append(textarea);reasonPanel.append(reasonLabel);
  const reasonButtons=make('div','ow-task-reason-buttons');
  const apply=make('button','ow-task-reason-apply',w.apply),cancel=make('button','ow-task-reason-cancel',w.cancel);
  apply.type=cancel.type='button';reasonButtons.append(apply,cancel);reasonPanel.append(reasonButtons);root.append(reasonPanel);
  const info=make('p','ow-task-inline-info');info.hidden=true;info.setAttribute('role','status');root.append(info);
  const notice=make('p','ow-task-preview-notice',execution?.lastError?'GitHub: '+execution.lastError:locked?w.closed:w.notice);root.append(notice);
  const progress=make('div','ow-task-universal-progress'),percent=Number(execution?.progress);
  const value=Number.isInteger(percent)&&percent>=0&&percent<=100?percent:0;
  const head=make('div','ow-task-universal-progress-head');head.append(make('span',null,w.progress),make('strong','ow-task-progress-value',value+'%'));progress.append(head);
  const track=make('div','ow-task-universal-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',w.progress);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(value));
  const fill=make('span','ow-task-universal-fill');fill.style.width=value+'%';track.append(fill);progress.append(track);
  progress.append(make('small','ow-task-progress-help',execution?.step?w.step+execution.step:execution?.dispatchStatus==='failed'?w.pending:w.notice));
  root.append(progress);
  const show=(message,error=false)=>{info.hidden=false;info.textContent=message;info.classList.toggle('ow-task-info-error',error);};
  let sending=false,selectedAction='';
  const send=async(action,extra={})=>{
   if(sending||typeof onAction!=='function'){show(w.error,true);return;}
   sending=true;
   for(const b of [start,postpone,reject,apply,acceptButton,rejectButton,reviewButton])if(b)b.disabled=true;
   try{await onAction({action,register,recordId:row.id,...extra});show(w.done);}
   catch(e){show((e?.message||w.error),true);}
   finally{sending=false;for(const b of [start,postpone,reject,apply,acceptButton,rejectButton,reviewButton])if(b)b.disabled=false;}
  };
  start.onclick=()=>{if(!deadline.value){deadline.focus();show(w.missingDate,true);return;}draft.deadline=deadline.value;void send('start',{deadline:draft.deadline});};
  const choose=action=>{selectedAction=action;reasonPanel.hidden=false;textarea.focus();show(action==='defer'?w.postpone+' · '+w.reason:w.reject+' · '+w.reason);};
  postpone.onclick=()=>choose('defer');reject.onclick=()=>choose('reject');cancel.onclick=()=>{reasonPanel.hidden=true;info.hidden=true;};
  apply.onclick=()=>{draft.reason=textarea.value.trim();if(draft.reason.length<10){textarea.focus();show(w.missingReason,true);return;}reasonPanel.hidden=true;void send(selectedAction,{reason:draft.reason});};
  let reviewButton=null,acceptButton=null,rejectButton=null;
  if(execution?.decision==='in_progress'&&['failed','pending'].includes(execution.dispatchStatus)){
   const retry=make('button','ow-task-github-retry',w.retry);retry.type='button';
   retry.onclick=()=>void send('dispatch');root.append(retry);
  }
  if(execution?.decision==='in_progress'&&value===100&&execution.checksPassed===true){
   reviewButton=make('button','ow-task-review-submit',w.review);reviewButton.type='button';
   reviewButton.onclick=()=>void send('submit_review');root.append(reviewButton);
  }
  if(execution?.decision==='review_pending'){
   const review=make('section','ow-task-owner-review');review.append(make('strong',null,w.reviewTitle));
   const decisionActions=make('div','ow-task-buttons');
   acceptButton=make('button','ow-task-btn ow-task-btn-start',w.accept);rejectButton=make('button','ow-task-btn ow-task-btn-reject',w.rejectReview);
   acceptButton.type=rejectButton.type='button';acceptButton.disabled=value!==100||execution.checksPassed!==true;
   acceptButton.onclick=()=>void send('accept');
   rejectButton.onclick=()=>{selectedAction='reject_review';reasonPanel.hidden=false;textarea.focus();};
   decisionActions.append(acceptButton,rejectButton);review.append(decisionActions);root.append(review);
  }
  return root;
 }
 window.OWRegisterTaskActions=Object.freeze({render,registers:Object.freeze([...REGISTERS])});
})();
