/* Staging improvement center. Self-contained view; API enforces role/row authorization. */
(function(){
"use strict";
const rootId="portal-feedback-root",api="/api/portal-feedback";
const categoryLabels={improvement:"Доработка",fix:"Исправление",development:"Разработка"};
const registerLabels={remarks:"Реестр замечаний",developments:"Реестр разработок",updates:"Реестр обновлений"};
const statusLabels={sent:"Отправлено",read:"Прочитано",evaluated:"Оценено",in_progress:"В работе",release:"Выпуск",denied:"Отказано в разработке",completed:"Завершено"};
const transitions={sent:["read","denied"],read:["evaluated","denied"],evaluated:["in_progress","denied"],in_progress:["release","denied"],release:["completed","in_progress"],denied:[],completed:[]};
const titleTranslations={
 ru:{owner:"Центр доработок",author:"Предложения",new:"Создать заявку",category:"Тип обращения",choose:"Выберите тип",description:"Описание",prompt:"Опишите, что нужно изменить или разработать",submit:"Отправить",cancel:"Отмена",my:"Мои заявки",all:"Все обращения",empty:"Заявок пока нет",refresh:"Обновить",status:"Статус",register:"Реестр",created:"Создано",authorLabel:"Автор",note:"Комментарий / причина",selectStatus:"Новый статус",date:"Дедлайн исполнения",save:"Изменить статус",history:"История обработки",open:"Подробнее",clear:"Выберите заявку из списка",error:"Не удалось выполнить действие",success:"Заявка отправлена и зарегистрирована",releaseHint:"Дедлайн сохраняется при смене статуса; это не дата выпуска",read:"Прочитать",summary:"Отправлено / В работе / Выпуск (дедлайн отдельно)",noAccess:"Не удалось подтвердить доступ",intro:"Обращения по улучшению сайта. Ставки и перевозки обрабатываются отдельно."},
 en:{owner:"Improvement center",author:"Suggestions",new:"Create request",category:"Request type",choose:"Select a type",description:"Description",prompt:"Describe the proposed improvement or fix",submit:"Submit",cancel:"Cancel",my:"My requests",all:"All requests",empty:"No requests yet",refresh:"Refresh",status:"Status",register:"Register",created:"Created",authorLabel:"Submitted by",note:"Comment / reason",selectStatus:"Next status",date:"Completion deadline",save:"Update status",history:"History",open:"Details",clear:"Select a request",error:"Action failed",success:"Request submitted",releaseHint:"The deadline is kept across statuses; it is not a publication date",read:"Mark as read",summary:"Submitted / In progress / Release (deadline separate)",noAccess:"Access could not be verified",intro:"Website improvement requests, separate from freight offers."},
 zh:{owner:"改进管理中心",author:"建议",new:"创建申请",category:"申请类型",choose:"选择类型",description:"说明",prompt:"请描述需要改进或修复的内容",submit:"提交",cancel:"取消",my:"我的申请",all:"所有申请",empty:"暂无申请",refresh:"刷新",status:"状态",register:"登记册",created:"创建时间",authorLabel:"提交人",note:"备注 / 原因",selectStatus:"新状态",date:"完成截止日期",save:"更新状态",history:"处理记录",open:"详情",clear:"请选择申请",error:"操作失败",success:"申请已提交",releaseHint:"状态变化不会清除截止日期；截止日期不是发布日期",read:"标记已读",summary:"已提交 / 处理中 / 发布阶段（截止日期单独显示）",noAccess:"无法验证访问权限",intro:"网站改进建议，与运输报价分开。"}
};
const byLang=(document.documentElement.lang||"ru").toLowerCase().startsWith("zh")?"zh":(document.documentElement.lang||"ru").toLowerCase().startsWith("en")?"en":"ru";
const t=()=>titleTranslations[byLang],esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let data={items:[],events:[],owner:false,role:""},loaded=false,showForm=false,draftCategory="",draftText="",selected="",registry="all",statusFilter="active",message="",error="",busy=false,lastRoot=null;
let releaseReadiness={taskId:'',ready:false,checks:[],passed:0,total:4,reason:'',message:'Ожидаются тесты'},releaseReadinessRequest=0;
let releaseRun={taskId:'',status:'not_started',message:''},releaseProgressRequest=0;
const releaseWords={
 ru:{prepare:'Запустить проверки',preflightQueued:'Проверяются базовые тесты, E2E на main и свежая резервная копия',prepareHelp:'Подготовка запускает только тесты; итоги появятся в X/4.',testsSummary:'Ожидаются тесты',readySummary:'Проверки пройдены, можно выпускать',blocked:'Ожидается завершение разработки (100%).',candidateMissing:'Кандидат выпуска не привязан к этой заявке: 4 проверки ещё не подготовлены.',candidateInvalid:'Для выпуска не указаны корректные SHA и четыре группы проверок.',checksPending:'Не все проверки frontend, backend, E2E и восстановления завершились успешно.',checksUnavailable:'Подтверждение проверок из GitHub сейчас недоступно.',devComplete:'Выпуск доступен после завершения разработки (100%).',title:'Публикация обновления',launch:'Выпустить обновление',running:'Выпуск выполняется',unstarted:'Нажмите кнопку для запуска проверок и публикации',queued:'Запрос принят GitHub; ожидается запуск',in_progress:'Выполняются проверки и публикация',failed:'Выпуск остановлен. Откройте журнал GitHub Actions',published:'Публикация подтверждена GitHub Actions',unknown:'Статус GitHub временно недоступен',journal:'Журнал выпуска'},
 en:{prepare:'Run release checks',preflightQueued:'Checking source tests, main E2E and a recent backup',prepareHelp:'Preflight runs checks only; results appear in X/4.',testsSummary:'Waiting for tests',readySummary:'Checks passed, ready to release',blocked:'Waiting for completed development (100%).',candidateMissing:'No release candidate is linked to this task; the four release checks are not configured yet.',candidateInvalid:'Valid source SHAs and all four check groups are missing.',checksPending:'Not all frontend, backend, E2E and recovery checks have passed.',checksUnavailable:'GitHub check evidence is currently unavailable.',devComplete:'Release is available once development reaches 100%.',title:'Publish update',launch:'Start release',running:'Release in progress',unstarted:'Start tests and publication with this button',queued:'GitHub accepted the request; waiting to start',in_progress:'Verification and publication in progress',failed:'Release stopped. Open GitHub Actions logs',published:'Publication confirmed by GitHub Actions',unknown:'GitHub status temporarily unavailable',journal:'Release log'},
 zh:{prepare:'运行发布检查',preflightQueued:'正在检查基础测试、main 分支端到端测试和最新备份',prepareHelp:'预检只运行检查，不发布；结果更新 X/4。',testsSummary:'等待测试',readySummary:'检查已通过，可以发布',blocked:'等待开发进度达到 100%。',candidateMissing:'此任务尚未关联发布候选版本，四项发布检查尚未配置。',candidateInvalid:'缺少有效源码 SHA 或四组必需检查。',checksPending:'前端、后端、端到端测试和恢复验证尚未全部通过。',checksUnavailable:'暂时无法从 GitHub 确认检查结果。',devComplete:'研发进度达到 100% 后可以发布。',title:'发布更新',launch:'启动发布',running:'正在发布',unstarted:'点击启动测试和发布',queued:'GitHub 已接收请求，等待启动',in_progress:'正在验证并发布',failed:'发布已停止，请查看 GitHub Actions 日志',published:'GitHub Actions 已确认发布',unknown:'GitHub 状态暂不可用',journal:'发布日志'}
};
const releaseT=()=>releaseWords[byLang]||releaseWords.ru;
const releaseStageWords={
 ru:{queued:'GitHub принял запрос, запуск в очереди.',verifying:'Проверяются подтверждение владельца и результаты приёмки.',backup:'Создаётся резервная копия и проверяется восстановление.',publishing:'Публикуются API и сайт.',readback:'Проверяются фактически опубликованные API и файлы.',published:'Выпущено. Production проверен.',verificationFailed:'Не подтверждены разрешение владельца или обязательные проверки.',backupFailed:'Не подтверждены резервная копия или восстановление.',releaseFailed:'Публикация остановлена. Подробности в журнале выпуска.',readbackFailed:'Фактическая публикация не подтверждена.',unknown:'Не удалось получить результаты запуска GitHub.',help:'Системный выпуск требует согласованного кандидата, полной приёмки, проверенного восстановления и подтверждения владельца.'},
 en:{queued:'GitHub accepted the request. Waiting for the workflow.',verifying:'Verifying Owner approval and acceptance evidence.',backup:'Creating the backup and testing recovery.',publishing:'Publishing the API and website.',readback:'Verifying the deployed API and files.',published:'Released. Production has been verified.',verificationFailed:'Owner approval or required evidence is missing.',backupFailed:'Backup or recovery is unverified.',releaseFailed:'Publication stopped. Open the release log for details.',readbackFailed:'The deployed release is unverified.',unknown:'GitHub run results are unavailable.',help:'A full release requires a compatible candidate, complete acceptance, verified recovery, and Owner approval.'},
 zh:{queued:'GitHub 已接受请求，工作流正在排队。',verifying:'正在验证所有者批准和验收证据。',backup:'正在创建备份并验证恢复。',publishing:'正在发布 API 和网站。',readback:'正在验证已部署的 API 和文件。',published:'已发布，生产环境已验证。',verificationFailed:'缺少所有者批准或必要的验证结果。',backupFailed:'尚未验证备份或恢复。',releaseFailed:'发布已停止，请查看发布日志。',readbackFailed:'尚未验证实际发布结果。',unknown:'暂时无法取得 GitHub 运行结果。',help:'完整发布必须使用兼容的候选版本，并完成验收、恢复验证和所有者批准。'}
};
const releaseStageKeys={queued:'queued',verifying:'verifying',backup:'backup','publishing-pages':'publishing','verifying-production':'readback'};
const releaseFailureKeys={RELEASE_VERIFICATION_UNPROVEN:'verificationFailed',BACKUP_ERROR:'backupFailed',RELEASE_ERROR:'releaseFailed',PRODUCTION_READBACK_UNPROVEN:'readbackFailed',GITHUB_RELEASE_JOBS_UNAVAILABLE:'unknown'};
const releaseWorkflow='https://github.com/hakaru4i-afk/freight-quotes-web/actions/workflows/owner-portal-release.yml';
const releaseIntentWords={
 ru:{prepare:'Подготовить выпуск',awaiting:'Ожидается подтверждение владельца в GitHub.',open:'Открыть защищённый выпуск',fields:'Укажите эти идентификаторы при запуске, чтобы связать выпуск с заявкой.'},
 en:{prepare:'Prepare release',awaiting:'Waiting for Owner approval in GitHub.',open:'Open protected release',fields:'Enter these identifiers in the workflow to link the release to this task.'},
 zh:{prepare:'准备发布',awaiting:'正在等待所有者在 GitHub 中批准。',open:'打开受保护的发布工作流',fields:'在工作流中填写这两个标识，以关联此任务的发布。'}
};
const releaseRequestId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hasReleaseIntent(run){
 return ['awaiting_owner','failed'].includes(run?.status)&&releaseRequestId.test(run.taskId||'')&&releaseRequestId.test(run.requestId||'');
}
function isPublicationConfirmed(run){
 return run?.status==='published'&&run.stage==='verified-production'&&run.progress===100&&
  Number.isSafeInteger(run.runId)&&run.runId>0&&Number.isSafeInteger(run.runAttempt)&&run.runAttempt>0;
}
function releaseProgressText(run){
 const words=releaseStageWords[byLang];
 if(isPublicationConfirmed(run))return words.published;
 if(run.status==='published')return words.readbackFailed;
 if(run.status==='awaiting_owner')return releaseIntentWords[byLang].awaiting;
 if(run.status==='unknown')return words.unknown;
 if(run.status==='failed')return words[releaseFailureKeys[run.reason]]||words.releaseFailed;
 return words[releaseStageKeys[run.stage]]||releaseT()[run.status]||releaseT().unstarted;
}
const codexErrorLabels={
 ru:{CODEX_NETWORK_BLOCKED_403:'Запуск Codex с Mac отклонён (HTTP 403); повторные нажатия не помогут.',CODEX_RATE_LIMITED:'Лимит запросов Codex.',CODEX_AUTH_EXPIRED:'Авторизация Codex истекла.',CODEX_SANDBOX_DENIED:'Codex не может изменять файлы.',CODEX_NO_CODE_CHANGES:'Codex не внёс изменений.',CODEX_WORKFLOW_FAILED:'Ошибка Codex. Откройте GitHub Actions.'},
 en:{CODEX_NETWORK_BLOCKED_403:'Codex launch from Mac was rejected (HTTP 403); retrying will not help.',CODEX_RATE_LIMITED:'Codex rate limit.',CODEX_AUTH_EXPIRED:'Codex login expired.',CODEX_SANDBOX_DENIED:'Codex cannot edit files.',CODEX_NO_CODE_CHANGES:'Codex made no changes.',CODEX_WORKFLOW_FAILED:'Codex failed. Open GitHub Actions.'},
 zh:{CODEX_NETWORK_BLOCKED_403:'Mac 上的 Codex 请求遭到拒绝（HTTP 403）；重试无效。',CODEX_RATE_LIMITED:'Codex 请求限制。',CODEX_AUTH_EXPIRED:'Codex 登录已过期。',CODEX_SANDBOX_DENIED:'Codex 无法编辑文件。',CODEX_NO_CODE_CHANGES:'Codex 未修改代码。',CODEX_WORKFLOW_FAILED:'Codex 执行失败，请查看 GitHub Actions。'}
};
const taskStatusLabels={
 ru:{label:'Статус разработки',codex_queued:'Codex в очереди',codex_failed:'Ошибка выполнения Codex',codex_complete:'Codex завершил работу; проверяется PR',task_queued:'Задача в очереди',branch_awaiting_codex:'Задача в GitHub, ожидает разработки через ChatGPT',codex_writing:'Codex пишет код (Работает)',scope_incomplete:'Проверки блока пройдены; задача ещё не завершена',ready_for_review:'Проверки пройдены, готов к приёмке',github_unavailable:'Нет связи с GitHub для проверки задания',dispatch_pending:'Ожидает отправки в GitHub',dispatch_failed:'Ошибка отправки в GitHub',branch_pending:'Задача в очереди',branch_created:'Задача в GitHub, ожидает разработки через ChatGPT',code_committed_pr_required:'Код создан, ожидается PR',pr_unavailable:'Не удалось проверить PR',checks_unavailable:'Результаты проверок недоступны',tests_running:'Код готов, открыт PR; идут проверки',basic_checks_failed:'Ошибка быстрых проверок',task_e2e_failed:'Ошибка проверки task-e2e',tests_failed:'Есть неуспешные проверки GitHub',required_tests_missing:'Код готов, открыт PR',owner_returned_for_rework:'Владелец вернул задачу на доработку',unknown:'Ожидаем подтверждения GitHub'},
 en:{label:'Development status',codex_queued:'Codex queued',codex_failed:'Codex failed',codex_complete:'Codex finished; checking PR',task_queued:'Task queued',branch_awaiting_codex:'GitHub task ready for implementation in ChatGPT',codex_writing:'Codex is writing code (Running)',scope_incomplete:'Block checks passed; task scope incomplete',ready_for_review:'Checks passed, ready for review',github_unavailable:'Unable to verify task with GitHub',dispatch_pending:'Waiting to send to GitHub',dispatch_failed:'GitHub dispatch failed',branch_pending:'Task queued',branch_created:'GitHub task ready for implementation in ChatGPT',code_committed_pr_required:'In progress. Waiting for a pull request',pr_unavailable:'Could not verify the pull request',checks_unavailable:'Check results unavailable',tests_running:'GitHub is running checks',basic_checks_failed:'Quick checks failed',task_e2e_failed:'The task-e2e check failed',tests_failed:'Some GitHub checks failed',required_tests_missing:'Code ready, PR opened',owner_returned_for_rework:'The Owner returned the task for rework',unknown:'Waiting for GitHub confirmation'},
 zh:{label:'开发状态',codex_queued:'Codex 排队中',codex_failed:'Codex 执行失败',codex_complete:'Codex 已完成，正在检查 PR',task_queued:'任务排队中',branch_awaiting_codex:'GitHub 任务已准备好，等待通过 ChatGPT 开发',codex_writing:'Codex 正在编写代码（运行中）',scope_incomplete:'阶段检查已通过，任务尚未完成',ready_for_review:'检查已通过，等待验收',github_unavailable:'无法连接 GitHub 验证任务',dispatch_pending:'等待发送到 GitHub',dispatch_failed:'发送到 GitHub 失败',branch_pending:'任务排队中',branch_created:'GitHub 任务已准备好，等待通过 ChatGPT 开发',code_committed_pr_required:'开发中，等待拉取请求',pr_unavailable:'无法验证拉取请求',checks_unavailable:'检查结果暂不可用',tests_running:'GitHub 正在运行检查',basic_checks_failed:'快速检查失败',task_e2e_failed:'task-e2e 检查失败',tests_failed:'部分 GitHub 检查失败',required_tests_missing:'代码已完成，PR 已创建',owner_returned_for_rework:'所有者已退回返工',unknown:'等待 GitHub 确认'}
};
function taskStatusText(execution){
 const labels=taskStatusLabels[byLang];
 if(execution?.checksPassed===true&&execution?.step==='ready_for_review') return labels.ready_for_review;
 if(execution?.step==='ready_for_review'&&execution?.checksPassed!==true)return labels.required_tests_missing;
 // The work branch may predate main: SHA mismatch is not proof Codex has run.
 if(execution?.codexStatus==='branch_awaiting_codex'&&execution?.step==='code_committed_pr_required')return labels.branch_awaiting_codex;
 if(execution?.dispatchStatus==='failed') return String(execution.lastError||'').startsWith('CODEX_')?labels.branch_awaiting_codex:labels.dispatch_failed;
 return Object.hasOwn(labels,execution?.step)?labels[execution.step]:labels.unknown;
}
const readinessReasonKeys={TASK_CANDIDATE_NOT_LINKED:'candidateMissing',EXACT_SHA_MISSING:'candidateInvalid',REQUIRED_CHECK_GROUPS_MISSING:'candidateInvalid',CHECK_SHA_OR_REPOSITORY_MISMATCH:'candidateInvalid',CHECKS_NOT_ALL_SUCCESSFUL:'checksPending',GITHUB_CHECKS_UNAVAILABLE:'checksUnavailable',CHECK_PROVIDER_UNAVAILABLE:'checksUnavailable'};
const releaseReason=()=>!releaseReadiness.ready?(releaseT()[readinessReasonKeys[releaseReadiness.reason]||'checksPending']||''):'';
let executionByFeedback=new Map(),handoffBusy=false,publishedReceipt=null;
// A successful released production receipt is distinct from an old task PR check run.
const issue173Marker='[WORK:owner-directive:20261122:deadline-not-release]';
function issue173Published(item){
 const e=executionByFeedback.get(item?.id);
 const proof=publishedReceipt?.issue173DeadlineFix;
 return item?.status!=='completed'&&item?.sender_role==='owner'&&String(item.description||'').includes(issue173Marker)&&
  e?.register==='remarks'&&e?.recordId==='RM-20261122-DEADLINE-01'&&
  publishedReceipt?.environment==='production'&&/^SH-01\.30\.(?:6[4-9]|[7-9][0-9]) v$/.test(publishedReceipt.businessVersion)&&
  proof?.ownerApproved===true&&proof?.backendRuntimeVersion===64&&/^[a-f0-9]{64}$/.test(proof.uiSha256||'');
}
async function fetchPublishedReceipt(){
 publishedReceipt=null;
 try{
  const url=new URL('production-release-manifest.json',document.baseURI);
  const response=await fetch(url.href,{cache:'no-store'});
  if(!response.ok)return;
  const receipt=await response.json();
  if(receipt?.environment==='production'&&typeof receipt.businessVersion==='string')publishedReceipt=receipt;
 }catch{publishedReceipt=null;}
}
const isReleaseReady=(item,isOwner,_readiness,execution)=>isOwner===true&&item?.status==='release'&&execution?.decision==='accepted'&&execution?.checksPassed===true&&execution?.step==='ready_for_review';
const formatTime=value=>value?new Date(value).toLocaleString(byLang==="zh"?"zh-CN":byLang==="en"?"en-GB":"ru-RU",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Minsk"}):"—";
const latestStatus=s=>statusLabels[s]||s;
// Existing release_date is an execution deadline; it never proves a publication.
const requestStatus=i=>issue173Published(i)?(byLang==='en'?'Published SH64':byLang==='zh'?'已发布 SH64':'Выпущено SH64'):latestStatus(i.status);
const minskToday=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const deadlineState=(item,execution)=>{
 if(!['in_progress','release'].includes(item?.status))return '';
 const labels=byLang==='en'?{ready:'Ready to release',late:'Overdue',blocked:'Blocked: tests have not passed',working:'In progress'}:byLang==='zh'?{ready:'准备发布',late:'已逾期',blocked:'已阻止：测试未通过',working:'处理中'}:{ready:'Готово к выпуску',late:'Просрочено',blocked:'Заблокировано: тесты не пройдены',working:'В работе'};
 if(execution?.checksPassed===true&&execution?.step==='ready_for_review')return labels.ready;
 if(/^\d{4}-\d{2}-\d{2}$/.test(String(item.release_date||''))&&minskToday()>item.release_date)return labels.late;
 if(['basic_checks_failed','task_e2e_failed','tests_failed','required_tests_missing'].includes(execution?.step)||execution?.checksPassed===false&&item.status==='release')return labels.blocked;
 return labels.working;
};
const categories=()=>({improvement:t().category==="Request type"?"Improvement":t().category==="申请类型"?"改进":categoryLabels.improvement,fix:byLang==="en"?"Fix":byLang==="zh"?"修复":categoryLabels.fix,development:byLang==="en"?"Development":byLang==="zh"?"开发":categoryLabels.development});
function root(){return document.getElementById(rootId);}
function notices(){return (error?'<div class="pf-error" role="alert">'+esc(error)+'</div>':"")+(message?'<div class="pf-success" role="status">'+esc(message)+'</div>':"");}
function form(){
 if(!showForm)return '<button type="button" class="pf-primary" data-pf="new">'+esc(t().new)+'</button>';
 return '<form id="pf-create" class="pf-form"><h3>'+esc(t().new)+'</h3><label>'+esc(t().category)+'<select name="category" required><option value="">'+esc(t().choose)+'</option>'+
 Object.entries(categories()).map(([key,label])=>'<option value="'+key+'"'+(draftCategory===key?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label>'+
 (draftCategory?'<label>'+esc(t().description)+'<textarea name="description" required maxlength="5000" minlength="10" rows="6" placeholder="'+esc(t().prompt)+'">'+esc(draftText)+'</textarea><small>10–5000 '+(byLang==="en"?"characters":byLang==="zh"?"个字符":"символов")+'</small></label>':'')+
 '<div class="pf-actions"><button type="submit" class="pf-primary" '+(!draftCategory||busy?'disabled':'')+'>'+esc(t().submit)+'</button><button type="button" class="pf-secondary" data-pf="cancel">'+esc(t().cancel)+'</button></div></form>';
}
function badge(i){return '<span class="pf-status pf-status-'+esc(issue173Published(i)?'completed':i.status)+'">'+esc(requestStatus(i))+'</span>';}
function itemsList(){
 let rows=data.items;
 if(data.owner){
  if(registry!=="all"){
   const ids=new Set(data.events.filter(e=>e.journal===registry).map(e=>e.request_id));
   rows=rows.filter(i=>registry==="updates"?ids.has(i.id):i.journal===registry);
  }
  if(statusFilter==='active')rows=rows.filter(i=>!['completed','denied'].includes(i.status));
  else if(statusFilter==='archive')rows=rows.filter(i=>['completed','denied'].includes(i.status));
  else if(statusFilter!=="all")rows=rows.filter(i=>i.status===statusFilter);
 }
 const filters=data.owner?'<div class="pf-filters"><label>'+esc(t().register)+'<select id="pf-register"><option value="all">'+esc(t().all)+'</option>'+
 Object.entries(registerLabels).map(([key,label])=>'<option value="'+key+'"'+(registry===key?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label>'+
 '<label>'+esc(t().status)+'<select id="pf-status-filter"><option value="active"'+(statusFilter==='active'?' selected':'')+'>'+esc(byLang==='en'?'Active':byLang==='zh'?'进行中':'Активные')+'</option><option value="archive"'+(statusFilter==='archive'?' selected':'')+'>'+esc(byLang==='en'?'Archive':byLang==='zh'?'归档':'Архив')+'</option><option value="all"'+(statusFilter==='all'?' selected':'')+'>'+esc(t().all)+'</option>'+
 Object.entries(statusLabels).map(([k,label])=>'<option value="'+k+'"'+(statusFilter===k?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label></div>':"";
 return filters+'<div class="pf-list">'+(rows.length?rows.map(i=>'<button type="button" class="pf-item '+(selected===i.id?'pf-selected':'')+'" data-pf-id="'+esc(i.id)+'" aria-label="'+esc(i.code)+'">'+
 '<span class="pf-item-top"><strong>'+esc(i.code)+'</strong>'+badge(i)+'</span><span class="pf-item-type">'+esc(categoryLabels[i.category]||i.category)+' · '+esc(registerLabels[i.journal]||"")+'</span>'+
 '<span class="pf-description">'+esc(i.description)+'</span><span class="pf-item-meta">'+esc(data.owner?i.sender_role+" · "+i.sender_login:formatTime(i.created_at))+'</span>'+
 (i.release_date?'<span class="pf-release">'+esc(t().date)+': '+esc(i.release_date)+'</span>':'')+
 '</button>').join(""):'<div class="pf-empty">'+esc(t().empty)+'</div>')+'</div>';
}
function detail(){
 const item=data.items.find(i=>i.id===selected);
 if(!item)return '<div class="pf-empty">'+esc(t().clear)+'</div>';
 const execution=executionByFeedback.get(item.id);
 const alreadyPublished=issue173Published(item);
 const handoff=Boolean(data.owner&&execution&&['new','in_progress'].includes(execution.decision)&&
  (['not_requested','pending'].includes(execution.dispatchStatus)||(execution.dispatchStatus==='failed'&&!String(execution.lastError||'').startsWith('CODEX_'))));
 const githubRegistered=Boolean(data.owner&&execution&&execution.decision==='in_progress'&&
  (execution.dispatchStatus==='dispatched'||(execution.dispatchStatus==='failed'&&String(execution.lastError||'').startsWith('CODEX_'))));
 const githubHandoffReady=githubRegistered&&['branch_awaiting_codex','code_committed_pr_required','checks_running','basic_checks_failed','task_e2e_failed','tests_failed','required_tests_missing','scope_incomplete','ready_for_review','codex_failed'].includes(execution?.step);
 const progressText=alreadyPublished?(byLang==='en'?'Deadline fix published in SH64. Historic task-e2e failure belongs to the pre-release PR.':byLang==='zh'?'截止日期修复已随 SH64 发布。旧的 task-e2e 错误属于发布前的 PR。':'Исправление дедлайна опубликовано в SH64. Старая ошибка task-e2e относится к PR до выпуска.'):taskStatusText(execution);
 const developmentLabel=taskStatusLabels[byLang].label;
 const taskRunUrl=typeof execution?.githubRunUrl==='string'&&/^https:\/\/github\.com\/hakaru4i-afk\/freight-quotes-web\/actions\/runs\/[0-9]+$/.test(execution.githubRunUrl)?execution.githubRunUrl:'';
 const deadlineStage=deadlineState(item,execution);
 const deadlinePanel=!alreadyPublished&&deadlineStage?'<p class="pf-deadline-state" role="status">'+esc(deadlineStage)+'</p>':'';
 const progressPanel=execution?'<section class="pf-codex-progress" aria-label="'+esc(developmentLabel)+'"><strong>'+esc(developmentLabel)+'</strong><p role="status">'+esc(progressText)+'</p>'+
  (!alreadyPublished&&execution.lastError&&!(githubRegistered&&String(execution.lastError).startsWith('CODEX_'))?'<p role="alert">'+esc((codexErrorLabels[byLang]||codexErrorLabels.ru)[execution.lastError]||execution.lastError)+'</p>':'')+
  (taskRunUrl?'<a href="'+esc(taskRunUrl)+'" target="_blank" rel="noopener noreferrer">GitHub Actions</a>':'')+'</section>':'';
 const words=byLang==='en'?{send:'Start development',tip:'Creates a GitHub issue and branch without Codex or paid API. To implement code, paste the copied prompt into ChatGPT.',date:'Completion deadline',copy:'Copy task for ChatGPT',registered:'Task registered in GitHub. To implement the code, paste the task into ChatGPT.',issues:'Open GitHub issues'}:
  byLang==='zh'?{send:'启动开发',tip:'在 GitHub 创建任务和分支，无需 Codex 或付费 API。编写代码需要将任务发送给 ChatGPT。',date:'完成截止日期',copy:'复制 ChatGPT 开发任务',registered:'任务已登记至 GitHub。将任务粘贴到 ChatGPT 以开始编写代码。',issues:'打开 GitHub 任务'}:
  {send:'Запустить разработку',tip:'Создаёт задачу и ветку GitHub без Codex и платного API. Для написания кода отправьте запрос в ChatGPT.',date:'Дедлайн исполнения',copy:'Скопировать задание для ChatGPT',registered:'Задача зарегистрирована в GitHub. Отправьте скопированный запрос в ChatGPT для написания кода.',issues:'Открыть задачи GitHub'};
 const handoffPanel=alreadyPublished?'<section class="pf-published-receipt"><p>'+esc(byLang==='en'?'Already published. No second Codex launch or release needed.':byLang==='zh'?'已发布，无需再次运行 Codex 或重新发布。':'Уже опубликовано. Повторный запуск Codex или выпуска не требуется.')+'</p><a href="https://github.com/hakaru4i-afk/freight-quotes-web/actions/runs/45224707351" target="_blank" rel="noopener noreferrer">'+esc(byLang==='en'?'Verified SH64 release':byLang==='zh'?'已验证的 SH64 发布':'Подтверждённый выпуск SH64')+'</a></section>':(handoff?'<form id="pf-development-handoff" class="pf-form" data-id="'+esc(item.id)+'"><h4>'+esc(words.send)+'</h4><p>'+esc(words.tip)+'</p><label>'+esc(words.date)+'<input type="date" name="deadline" required value="'+esc(execution.deadline||item.release_date||'')+'"/></label><button type="submit" class="pf-primary" '+(handoffBusy||busy?'disabled':'')+'>'+esc(words.send)+'</button></form>':'')+
  (githubHandoffReady?'<section class="pf-development-chatgpt"><p>'+esc(words.registered)+'</p><button type="button" class="pf-secondary" data-pf="copy-development-prompt" '+(busy||handoffBusy?'disabled':'')+'>'+esc(words.copy)+'</button><p><a href="https://github.com/hakaru4i-afk/freight-quotes-web/issues" target="_blank" rel="noopener noreferrer">'+esc(words.issues)+'</a></p></section>':'');
 const ev=data.events.filter(e=>e.request_id===item.id).slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const choices=(transitions[item.status]||[]).filter(status=>!['completed','release'].includes(status)&&!alreadyPublished&&!['in_progress','review_pending','accepted'].includes(execution?.decision));
 // Completing an item manually is never a substitute for a verified production deployment.
 const releaseEligible=data.owner&&!alreadyPublished&&['in_progress','release'].includes(item.status);
 const releaseReady=isReleaseReady(item,data.owner,releaseReadiness,execution);
 const runState=releaseRun.taskId===item.id?releaseRun:{taskId:item.id,status:'not_started'};
 const isRunning=['queued','in_progress'].includes(runState.status);
 const isConfirmed=isPublicationConfirmed(runState);
 const intent=hasReleaseIntent(runState);
 const isUnverified=runState.status==='unknown'||runState.status==='published'&&!isConfirmed;
 const lines=releaseT();
 const intentLines=releaseIntentWords[byLang];
 const notice=runState.status==='not_started'&&!releaseReady?progressText:releaseProgressText(runState);
 const actionUrl=typeof runState.url==='string'&&/^https:\/\/github\.com\/hakaru4i-afk\/freight-quotes-web\/actions\/(?:runs\/[1-9][0-9]*|workflows\/owner-portal-release\.yml)$/.test(runState.url)?runState.url:'';
 const releaseControls=releaseEligible?'<section class="pf-release-guard" aria-label="'+esc(lines.title)+'">'+
  '<h4>'+esc(lines.title)+'</h4>'+
  (runState.status!=='not_started'||!execution?'<p class="'+(isConfirmed?'pf-ci-success':'pf-ci-wait')+'" role="status">'+esc(notice)+'</p>':'')+
  '<small>'+esc(releaseStageWords[byLang].help)+'</small>'+
  (actionUrl&&actionUrl!==releaseWorkflow?'<p><a href="'+esc(actionUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(lines.journal)+'</a></p>':'')+
  (intent?'<p><a href="'+releaseWorkflow+'" target="_blank" rel="noopener noreferrer">'+esc(intentLines.open)+'</a></p>'+
    '<small>'+esc(intentLines.fields)+'</small><dl><dt>task_id</dt><dd><code>'+esc(runState.taskId)+'</code></dd><dt>request_id</dt><dd><code>'+esc(runState.requestId)+'</code></dd></dl>':
   '<button class="pf-primary" type="button" data-pf="release-update" '+(!releaseReady||isRunning||isConfirmed||isUnverified||busy?'disabled':'')+'>'+esc(isRunning?lines.running:intentLines.prepare)+'</button>')+'</section>':'';
 const l=byLang==='en'?{send:'Submit for review',accept:'Accept implementation',return:'Return for rework',reason:'What is wrong and how to fix it? Required comment (at least 10 characters)',archive:'Confirm publication and archive',accepted:'Implementation accepted. Publish before archiving.',waiting:'Development must pass GitHub tests before review.',archiveReady:'Publication has been verified. Confirm archive.'}:
 byLang==='zh'?{send:'提交验收',accept:'接受开发结果',return:'退回修改',reason:'请说明错误和必要的修改（必填至少10字）',archive:'确认发布并归档',accepted:'已接受开发结果，须发布后归档。',waiting:'需通过 GitHub 检查才能提交验收。',archiveReady:'发布已验证，请确认归档。'}:
 {send:'Отправить на приёмку',accept:'Принять разработку',return:'Вернуть на доработку',reason:'Что не так и что нужно исправить? Обязательный комментарий (не менее 10 символов)',archive:'Подтвердить выпуск и в архив',accepted:'Разработка принята. После публикации можно закрыть задачу.',waiting:'Сначала нужны успешные проверки GitHub; статус «Выпуск» вручную не выбирается.',archiveReady:'Публикация подтверждена. Можно закрыть задачу и перенести в архив.'};
 const reviewPhase=execution?.decision==='review_pending'&&item.status==='release';
 const acceptedPhase=execution?.decision==='accepted'&&item.status==='release';
 const canSubmit=execution?.decision==='in_progress'&&item.status==='in_progress'&&execution?.checksPassed===true&&execution?.step==='ready_for_review';
 const canArchive=data.owner&&!['completed','denied'].includes(item.status)&&(alreadyPublished||(acceptedPhase&&isConfirmed));
 const workflowPanel=!data.owner?'':canArchive?
  '<section class="pf-workflow-actions"><p>'+esc(l.archiveReady)+'</p><button class="pf-primary" data-pf="archive-published" type="button" '+(busy?'disabled':'')+'>'+esc(l.archive)+'</button></section>':
  reviewPhase||acceptedPhase?
   '<section class="pf-workflow-actions">'+
   (reviewPhase?'<button class="pf-primary" data-pf="accept-review" type="button" '+(busy?'disabled':'')+'>'+esc(l.accept)+'</button>':'<p>'+esc(l.accepted)+'</p>')+
   '<form id="pf-rework" class="pf-form" data-id="'+esc(item.id)+'"><label>'+esc(l.reason)+'<textarea name="reason" minlength="10" maxlength="1000" rows="4" required placeholder="'+esc(l.reason)+'"></textarea></label>'+
   '<small>'+esc(byLang==='en'?'Feedback is saved in the history and sent to the linked GitHub Issue for ChatGPT.':byLang==='zh'?'评论保存在历史记录中并发送到 GitHub Issue，供 ChatGPT 读取。':'Комментарий сохранится в истории и будет отправлен в GitHub Issue для ChatGPT.')+'</small>'+
   '<button type="submit" class="pf-secondary" '+(busy?'disabled':'')+'>'+esc(l.return)+'</button></form></section>':
  execution?.decision==='in_progress'&&item.status==='in_progress'?
   '<section class="pf-workflow-actions"><p>'+esc(l.waiting)+'</p><button class="pf-primary" data-pf="submit-review" type="button" '+(!canSubmit||busy?'disabled':'')+'>'+esc(l.send)+'</button></section>':'';
 const updateControls=data.owner&&choices.length?'<form id="pf-update" data-id="'+esc(item.id)+'" class="pf-form">'+
 '<label>'+esc(t().selectStatus)+'<select name="status" required><option value="">'+esc(t().choose)+'</option>'+
 choices.map(s=>'<option value="'+s+'">'+esc(statusLabels[s])+'</option>').join("")+'</select></label>'+
 '<label>'+esc(t().note)+'<textarea rows="3" name="note" maxlength="2000" placeholder="'+esc(t().note)+'"></textarea></label>'+
 '<label class="pf-date-field">'+esc(t().date)+'<input type="date" name="releaseDate" value="'+esc(item.release_date||'')+'"/><small>'+esc(t().releaseHint)+'</small></label>'+
 '<button class="pf-primary" type="submit" '+(busy?'disabled':'')+'>'+esc(t().save)+'</button></form>':"";
 return '<article class="pf-detail"><div class="pf-item-top"><h3>'+esc(item.code)+'</h3>'+badge(item)+'</div>'+
 '<p class="pf-type">'+esc(categoryLabels[item.category])+' · '+esc(registerLabels[item.journal])+'</p>'+
 '<p class="pf-body">'+esc(item.description)+'</p>'+
 '<dl><dt>'+esc(t().authorLabel)+'</dt><dd>'+esc(item.sender_role+" · "+item.sender_login)+'</dd>'+
 '<dt>'+esc(t().created)+'</dt><dd>'+esc(formatTime(item.created_at))+'</dd>'+
 (item.release_date?'<dt>'+esc(t().date)+'</dt><dd>'+esc(item.release_date)+'</dd>':'')+
 (item.owner_note?'<dt>'+esc(t().note)+'</dt><dd>'+esc(item.owner_note)+'</dd>':'')+'</dl>'+
 progressPanel+deadlinePanel+handoffPanel+workflowPanel+releaseControls+updateControls+'<h4>'+esc(t().history)+'</h4><ol class="pf-history">'+ev.map(e=>'<li><span>'+esc(formatTime(e.created_at))+' · '+esc(statusLabels[e.status]||e.status)+'</span><small>'+esc(registerLabels[e.journal]||"")+' · '+esc(e.actor_login)+'</small><p>'+esc(e.description)+'</p></li>').join("")+'</ol></article>';
}
function render(){
 const r=root();if(!r)return;
 lastRoot=r;
 if(!loaded){r.innerHTML='<div class="pf-shell"><p>'+esc(t().refresh)+'…</p></div>';return;}
 const count=data.items.filter(i=>i.status==="sent").length,working=data.items.filter(i=>i.status==="in_progress").length,planned=data.items.filter(i=>i.status==="release").length;
 r.innerHTML='<div class="pf-shell"><header class="pf-header"><div><span class="pf-kicker">Маршрут · Development workflow</span><h1>'+esc(data.owner?t().owner:t().author)+'</h1><p>'+esc(t().intro)+'</p></div><button type="button" class="pf-secondary" data-pf="refresh">'+esc(t().refresh)+'</button></header>'+
 notices()+(data.owner?'<div class="pf-metrics"><div><strong>'+count+'</strong><span>'+esc(statusLabels.sent)+'</span></div><div><strong>'+working+'</strong><span>'+esc(statusLabels.in_progress)+'</span></div><div><strong>'+planned+'</strong><span>'+esc(statusLabels.release)+'</span></div></div>':'<div class="pf-compose">'+form()+'</div>')+
 '<div class="pf-workspace"><section class="pf-requests"><h2>'+esc(data.owner?t().all:t().my)+'</h2>'+itemsList()+'</section><section class="pf-details">'+detail()+'</section></div></div>';
}
async function apiCall(action,dataToSend){
 const opts=action==="load"?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(dataToSend),cache:"no-store"};
 const res=await fetch(api,opts),out=await res.json().catch(()=>({}));
 if(!res.ok||!out.ok)throw Error(out.error||"HTTP "+res.status);
 return out;
}
async function fetchExecutions(){
 if(!data.owner){executionByFeedback=new Map();return;}
 const registers=['developments','remarks','updates'];
 const requests=await Promise.allSettled(registers.map(async reg=>{
  const response=await fetch('/api/owner-register-execution?register='+encodeURIComponent(reg),{cache:'no-store'});
  const body=await response.json();if(!response.ok||body.ok!==true)throw Error(body.error||'HTTP '+response.status);
  return body.items||[];
 }));
 const next=new Map();for(const req of requests)if(req.status==='fulfilled')for(const x of req.value){
  if(x.feedbackId&&!next.has(x.feedbackId))next.set(x.feedbackId,x);
 }
 executionByFeedback=next;
}
async function load(){
 if(busy)return;
 try{const json=await apiCall("load");data=json;loaded=true;error="";await Promise.all([fetchExecutions(),fetchPublishedReceipt()]);if(selected&&!data.items.some(i=>i.id===selected))selected="";render();void refreshReleaseReadiness();void refreshReleaseProgress();}
 catch(e){loaded=true;data={...data,items:[],events:[]};error=t().noAccess+": "+e.message;render();}
}
async function refreshReleaseReadiness(){
 const item=data.items.find(i=>i.id===selected);
 releaseReadiness={taskId:item?.id||'',ready:false,checks:[],passed:0,total:0,reason:'',message:''};
}
async function refreshReleaseProgress(){
 const item=data.items.find(i=>i.id===selected);
 const seq=++releaseProgressRequest;
 if(!data.owner||!item||issue173Published(item)||!['in_progress','release'].includes(item.status)){releaseRun={taskId:'',status:'not_started'};return;}
 try{
  const response=await fetch(api+'?releaseProgress='+encodeURIComponent(item.id),{cache:'no-store'});
  const body=await response.json();
  if(seq!==releaseProgressRequest||selected!==item.id)return;
  if(!response.ok||body.ok!==true)throw Error(body.error||'HTTP '+response.status);
  releaseRun=body.release||{taskId:item.id,status:'unknown'};
 }catch{if(seq!==releaseProgressRequest||selected!==item.id)return;releaseRun={taskId:item.id,status:'unknown'};}
 render();
}
async function runGithubHandoff(item,deadline){
 if(handoffBusy||busy)return;
 const execution=executionByFeedback.get(item.id);
 if(!data.owner||!execution||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(deadline)){
  error='Укажи корректный дедлайн и обнови задачу';render();return;
 }
 handoffBusy=true;error='';message='';render();
 const call=async action=>{
  const response=await fetch('/api/owner-register-execution',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,register:execution.register,recordId:execution.recordId,...(action==='start'?{deadline}:{})})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw Error([result.error||'HTTP '+response.status,result.detail].filter(Boolean).join(': '));
  return result;
 };
 try{
  await call('start');
  const result=await call('dispatch');
  message=byLang==='en'?'Development request sent to GitHub; code writing requires a ChatGPT chat.':byLang==='zh'?'开发任务已发送至 GitHub；请在 ChatGPT 对话中发送任务以编写代码。':'Разработка зарегистрирована в GitHub. Для написания кода отправьте задание в ChatGPT.';
  if(result.already)message=byLang==='en'?'Already registered on GitHub.':byLang==='zh'?'已在 GitHub 登记。':'Задача уже передана в GitHub.';
 }catch(e){error='Передача не выполнена: '+(e?.message||'Неизвестная ошибка');}
 finally{const failure=error;handoffBusy=false;await load();if(failure)error=failure;render();}
}
function developmentChatPrompt(execution){
 const record=String(execution?.recordId||'');
 const register=String(execution?.register||'');
 if(!/^[A-Za-z0-9_.:-]{1,120}$/.test(record)||!['developments','remarks','updates'].includes(register))return '';
 return 'Возьми в разработку задачу '+register+'/'+record+' из GitHub репозитория hakaru4i-afk/freight-quotes-web. Найди связанный Issue и ветку owner-task/, внеси реальные изменения, создай PR и проверь тесты. Не используй платный OpenAI API или Codex на Mac. Не публикуй изменения без подтверждения владельца.';
}
async function copyDevelopmentPrompt(item){
 const prompt=developmentChatPrompt(executionByFeedback.get(item.id));
 if(!data.owner||!prompt){error='Задача GitHub ещё не найдена';render();return;}
 try{
  if(!navigator.clipboard?.writeText)throw Error('CLIPBOARD_UNAVAILABLE');
  await navigator.clipboard.writeText(prompt);
  message=byLang==='en'?'Task copied. Paste it into ChatGPT to begin implementation.':byLang==='zh'?'任务已复制，请粘贴到 ChatGPT 开始开发。':'Задание скопировано. Отправьте его в ChatGPT для начала разработки.';
  error='';
 }catch{error=byLang==='en'?'Copy failed. Open the GitHub task in ChatGPT.':byLang==='zh'?'复制失败，请在 ChatGPT 中打开 GitHub 任务。':'Копирование недоступно. Откройте задачу GitHub и передайте её в ChatGPT.';}
 render();
}

async function ownerReviewAction(item,action,reason=''){
 if(busy||!data.owner)return;
 const e=executionByFeedback.get(item.id);
 if(!e?.register||!e?.recordId){error='Нет связанной задачи GitHub';render();return;}
 if(action==='return_for_rework'&&reason.trim().length<10){error='Укажите причину доработки от 10 символов';render();return;}
 busy=true;error='';message='';render();
 try{
  const response=await fetch('/api/owner-register-execution',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
   body:JSON.stringify({action,register:e.register,recordId:e.recordId,...(reason?{reason:reason.trim()}:{})})});
  const out=await response.json().catch(()=>({}));
  if(!response.ok||out.ok!==true)throw Error([out.error||'HTTP '+response.status,out.detail].filter(Boolean).join(': '));
  await load();selected=item.id;
  message=action==='return_for_rework'?'Задача возвращена в разработку; комментарий сохранён в истории и GitHub.':
   action==='accept'?'Разработка принята. Требуется публикация.':'Отправлено на приёмку.';
  render();
 }catch(err){error='Действие не выполнено: '+(err?.message||'неизвестная ошибка');render();}
 finally{busy=false;render();}
}
async function runAction(payload){
 if(busy)return;
 busy=true;error="";message="";render();
 try{const out=await apiCall("post",payload);busy=false;const preferred=out.item?.id||selected;if(payload.action==='release_update'&&out.release)releaseRun=out.release;if(payload.action==='archive_published')statusFilter='archive';await load();selected=preferred;if(payload.action==="create"){showForm=false;draftText="";draftCategory="";message=t().success;}else if(payload.action==='release_update'){message=releaseProgressText(releaseRun);void refreshReleaseProgress();}else if(payload.action==='prepare_release'){message=releaseT().preflightQueued;void refreshReleaseReadiness();}else message=statusLabels[out.item?.status]||"";render();}
 catch(e){busy=false;error=t().error+": "+e.message;render();}
}
document.addEventListener("click",ev=>{
 const r=root();if(!r||!r.contains(ev.target))return;
 const id=ev.target.closest("[data-pf-id]")?.dataset.pfId;
 if(id){selected=id;render();const i=data.items.find(x=>x.id===id);if(data.owner&&i?.status==="sent")void runAction({action:"set_status",id,expectedStatus:"sent",status:"read",note:""});else {void refreshReleaseReadiness();void refreshReleaseProgress();}return;}
 const action=ev.target.closest("[data-pf]")?.dataset.pf;
 if(action==="new"){showForm=true;render();}
 if(action==="cancel"){showForm=false;draftCategory="";draftText="";render();}
 if(action==="refresh")void load();
 if(action==='submit-review'||action==='accept-review'){
  const item=data.items.find(i=>i.id===selected);if(item)void ownerReviewAction(item,action==='submit-review'?'submit_review':'accept');
 }
 if(action==='archive-published'){
  const item=data.items.find(i=>i.id===selected);if(item&&!busy)void runAction({action:'archive_published',id:item.id,expectedStatus:item.status});
 }
 if(action==='copy-development-prompt'){
  const item=data.items.find(i=>i.id===selected);
  if(item)void copyDevelopmentPrompt(item);
 }
 if(action==="release-update"){
  const item=data.items.find(i=>i.id===selected);
  if(isReleaseReady(item,data.owner,releaseReadiness,executionByFeedback.get(item?.id))&&!busy)
   void runAction({action:'release_update',id:item.id,expectedStatus:item.status});
 }
});
document.addEventListener("input",ev=>{
 if(!root()?.contains(ev.target))return;
 if(ev.target.name==="description"&&ev.target.closest("#pf-create"))draftText=ev.target.value;
});
document.addEventListener("change",ev=>{
 if(!root()?.contains(ev.target))return;
 if(ev.target.name==="category"&&ev.target.closest("#pf-create")){draftCategory=ev.target.value;render();root()?.querySelector("#pf-create textarea")?.focus();}
 if(ev.target.id==="pf-register"){registry=ev.target.value;render();}
 if(ev.target.id==="pf-status-filter"){statusFilter=ev.target.value;render();}
});
document.addEventListener("submit",ev=>{
 if(!root()?.contains(ev.target))return;
 if(ev.target.id==="pf-create"){ev.preventDefault();const f=ev.target;const desc=f.description?.value||draftText;void runAction({action:"create",category:f.category.value,description:desc});}
 if(ev.target.id==="pf-update"){ev.preventDefault();const f=ev.target,item=data.items.find(i=>i.id===f.dataset.id);if(!item)return;void runAction({action:"set_status",id:item.id,expectedStatus:item.status,status:f.elements.status.value,note:f.elements.note.value,releaseDate:f.elements.releaseDate.value});}
 if(ev.target.id==='pf-rework'){
  ev.preventDefault();const f=ev.target,item=data.items.find(i=>i.id===f.dataset.id);
  if(item)void ownerReviewAction(item,'return_for_rework',f.elements.reason.value);
 }
 if(ev.target.id==='pf-development-handoff'){
  ev.preventDefault();const form=ev.target,item=data.items.find(i=>i.id===form.dataset.id);
  if(item)void runGithubHandoff(item,form.elements.deadline.value);
 }
});
let pending=false;
const obs=new MutationObserver(()=>{
 if(pending)return;
 const r=root();
 if(!r||r===lastRoot)return;
 pending=true;requestAnimationFrame(()=>{pending=false;lastRoot=r;loaded=false;render();void load();});
});
obs.observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{if(document.visibilityState==='visible'&&data.owner&&selected){void fetchExecutions().then(()=>render()).catch(()=>{error='GitHub status is temporarily unavailable';render();});void refreshReleaseReadiness();void refreshReleaseProgress();}},30000);
if(root()){render();void load();}
})();
