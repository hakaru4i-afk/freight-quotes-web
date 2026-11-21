/* Universal stage-one task controls for Owner's three engineering registers.
   UI preview ONLY. No status writes, GitHub webhook or progress polling until Stage 2. */
(()=>{'use strict';
 const REGISTERS=new Set(['remarks','developments','updates']);
 const DRAFTS=new Map();
 const WORDS=[
  {deadline:'Плановый дедлайн',choose:'Выберите дату',start:'Запустить в разработку',postpone:'Отложить',reject:'Отклонить',reason:'Причина решения',reasonPlaceholder:'Укажите причину (обязательно)',confirm:'Проверить оформление',cancel:'Отмена',progress:'Прогресс выполнения',missingDate:'Укажите плановую дату перед запуском.',missingReason:'Укажите причину (не менее 5 символов).',startPreview:'Дата выбрана. Запуск задачи и изменение статуса будут подключены на Этапе 2.',reasonPreview:'Причина указана. Изменения пока не записываются в базу.',notice:'Этап 1 · Предпросмотр интерфейса. Кнопки не изменяют данные.',progressNote:'События GitHub Actions подключаются на Этапе 2.',closed:'Историческая или опубликованная запись · действия недоступны.'},
  {deadline:'Planned deadline',choose:'Choose a date',start:'Start development',postpone:'Defer',reject:'Reject',reason:'Decision reason',reasonPlaceholder:'Enter a reason (required)',confirm:'Preview decision',cancel:'Cancel',progress:'Task progress',missingDate:'Choose a planned deadline before starting.',missingReason:'Please enter at least 5 characters.',startPreview:'Deadline selected. Start and status changes will be enabled in Stage 2.',reasonPreview:'Reason entered. No changes have been saved to the database.',notice:'Stage 1 · UI preview. Buttons do not change records.',progressNote:'GitHub Actions updates arrive in Stage 2.',closed:'Historical or published record · actions unavailable.'},
  {deadline:'计划截止日期',choose:'请选择日期',start:'开始开发',postpone:'延期',reject:'拒绝',reason:'决定理由',reasonPlaceholder:'请输入理由（必填）',confirm:'预览决定',cancel:'取消',progress:'任务进度',missingDate:'请先选择计划截止日期。',missingReason:'请填写不少于五个字符的理由。',startPreview:'已选择日期。正式启动与状态更新将在第二阶段接入。',reasonPreview:'已填写原因。尚未写入数据库。',notice:'阶段一 · 界面预览。按钮不会更改数据。',progressNote:'GitHub Actions 进度将在第二阶段接入。',closed:'历史或已发布记录 · 无法操作。'}
 ];
 const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
 const locale=()=>/^zh/i.test(document.documentElement.lang)?2:/^en/i.test(document.documentElement.lang)?1:0;
 const isoDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
 function render({register,row,job,state}={}){
  if(!REGISTERS.has(register)||!row||!row.id)throw Error('REGISTER_UI_INVALID_RECORD');
  const w=WORDS[locale()],key=register+':'+row.id;
  const draft=DRAFTS.get(key)||{deadline:isoDate(row.deadline||row.plannedDate||job?.deadline_at?.slice(0,10)),reason:''};
  DRAFTS.set(key,draft);
  const locked=Boolean(row.historyOnly||row.archived||['published','production_verified','accepted','rejected'].includes(state)||['in_progress','release','completed','denied'].includes(job?.status));
  const root=node('section','ow-task-universal');root.dataset.sharedTaskControls='stage1';root.dataset.register=register;
  const deadlineLabel=node('label','ow-task-deadline');
  deadlineLabel.append(node('span','ow-task-field-name',w.deadline));
  const deadline=node('input','ow-task-deadline-input');deadline.type='date';deadline.value=draft.deadline;
  deadline.required=true;deadline.disabled=locked;deadline.setAttribute('aria-label',w.deadline);
  deadline.oninput=()=>{draft.deadline=deadline.value;info.textContent='';info.hidden=true;};
  deadlineLabel.append(deadline);root.append(deadlineLabel);
  const controls=node('div','ow-task-buttons');
  const button=(name,type)=>{const b=node('button','ow-task-btn ow-task-btn-'+type,name);b.type='button';b.disabled=locked;return b;};
  const start=button(w.start,'start'),postpone=button(w.postpone,'postpone'),reject=button(w.reject,'reject');
  controls.append(start,postpone,reject);root.append(controls);
  const reasonPanel=node('div','ow-task-reason');reasonPanel.hidden=true;
  const reasonLabel=node('label','ow-task-reason-label');reasonLabel.append(node('span',null,w.reason));
  const reason=node('textarea','ow-task-reason-textarea');reason.rows=3;reason.maxLength=1000;reason.placeholder=w.reasonPlaceholder;reason.value=draft.reason;reasonLabel.append(reason);reasonPanel.append(reasonLabel);
  const reasonButtons=node('div','ow-task-reason-buttons');
  const commit=node('button','ow-task-reason-apply',w.confirm),cancel=node('button','ow-task-reason-cancel',w.cancel);
  commit.type=cancel.type='button';reasonButtons.append(commit,cancel);reasonPanel.append(reasonButtons);root.append(reasonPanel);
  const info=node('p','ow-task-inline-info');info.hidden=true;info.setAttribute('role','status');root.append(info);
  const notice=node('p','ow-task-preview-notice',locked?w.closed:w.notice);root.append(notice);
  const progress=node('div','ow-task-universal-progress');
  const caption=node('div','ow-task-universal-progress-head');caption.append(node('span',null,w.progress),node('strong','ow-task-progress-value','0%'));progress.append(caption);
  const track=node('div','ow-task-universal-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',w.progress);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow','0');
  track.append(node('span','ow-task-universal-fill'));progress.append(track);
  progress.append(node('small','ow-task-progress-help',w.progressNote));root.append(progress);
  const show=(text,error=false)=>{info.hidden=false;info.textContent=text;info.classList.toggle('ow-task-info-error',error);};
  start.onclick=()=>{if(!deadline.value){deadline.focus();show(w.missingDate,true);return;}draft.deadline=deadline.value;show(w.startPreview);};
  let action='';
  const choose=type=>{action=type;reasonPanel.hidden=false;reason.focus();show(type==='postpone'?w.postpone+' · '+w.reason:w.reject+' · '+w.reason);};
  postpone.onclick=()=>choose('postpone');reject.onclick=()=>choose('reject');
  cancel.onclick=()=>{reasonPanel.hidden=true;show(w.notice);};
  commit.onclick=()=>{draft.reason=reason.value.trim();if(draft.reason.length<5){reason.focus();show(w.missingReason,true);return;}reasonPanel.hidden=true;show(w.reasonPreview);};
  return root;
 }
 window.OWRegisterTaskActions=Object.freeze({render,registers:Object.freeze([...REGISTERS])});
})();
