/* Owner-only GitHub release progress. No private data or access tokens. */
export const TASK=Object.freeze({title:'SH59 — выпуск портала',pr:145,audit:44802361801,repo:'hakaru4i-afk/freight-quotes-web'});
const ROOT='https://api.github.com/repos/'+TASK.repo+'/';
const SOURCES={handoff:'SH59 immutable tested-source handoff (staging only)',regression:'Release stabilization candidate',alignment:'Canonical staging alignment'};
const TESTED_WEB='6e0a465b2b031558989f62b38dc7939797434686';
const TESTED_API='092decf57d97fabdefa35bba0593890f52d34ef6';
const TESTED_BUNDLE='2875f4dc43dcc61a8b191edcf70281d7f1b8875847bc9e0b276160bdfe6b0b87';
const validSha=value=>/^[a-f0-9]{40}$/.test(value||'');
const stamp=value=>Date.parse(value||'')||0;
export function summarize({pr,audit,runs=[],job=null,parity=null,publication=null}={}){
 const validPr=pr?.number===TASK.pr&&pr?.base?.ref==='main'&&pr?.head?.repo?.full_name===TASK.repo&&validSha(pr?.head?.sha);
 const sha=validPr?pr.head.sha:null;
 const matching=validPr?runs.filter(r=>r?.head_sha===sha&&r?.head_branch===pr.head.ref&&r?.event==='pull_request'&&r?.head_repository?.full_name===TASK.repo):[];
 const sorted=[...matching].sort((a,b)=>stamp(b.updated_at||b.created_at)-stamp(a.updated_at||a.created_at));
 const checks=Object.fromEntries(Object.entries(SOURCES).map(([key,name])=>[key,sorted.find(x=>x.name===name)]));
 const e2e=audit?.id===TASK.audit&&audit?.path==='.github/workflows/sh59-protected-37-audit.yml'&&audit?.head_repository?.full_name===TASK.repo&&audit?.status==='completed'&&audit?.conclusion==='success';
 const parityPassed=checks.alignment?.conclusion==='success'&&parity?.runtimePairStatus==='VERIFIED'&&parity?.frontendCommit===TESTED_WEB&&parity?.apiSourceCommit===TESTED_API&&parity?.apiBundleSha256===TESTED_BUNDLE&&parity?.qaEvidence?.fullGroupsPassed===37;
 const deployment=publication?.manifest,build=publication?.build,release=publication?.release;
 const releasePassed=parityPassed&&deployment?.businessVersion==='SH-01.30.59 v'&&deployment?.environment==='production'&&deployment?.sourceStagingFrontendCommit===TESTED_WEB&&build?.environment==='production'&&build?.releaseVersion==='SH-01.30.59 v'&&build?.build===deployment?.frontendBuild&&release?.event==='workflow_dispatch'&&release?.conclusion==='success'&&release?.publishJob===true;
 const stages=[
  {label:'Защищённая приёмка 37/37',passed:e2e===true},
  {label:'Проверка механизма переноса',passed:checks.handoff?.conclusion==='success'},
  {label:'Полная регрессия frontend',passed:checks.regression?.conclusion==='success'},
  {label:'Согласование staging',passed:checks.alignment?.conclusion==='success'},
  {label:'Совместимость опубликованного API',passed:parityPassed===true},
  {label:'Резервная копия, разрешение и выпуск',passed:releasePassed===true}
 ];
 const passed=stages.filter(x=>x.passed).length;
 const currentByWorkflow=[];const seen=new Set();for(const run of sorted){if(!seen.has(run.name)){seen.add(run.name);currentByWorkflow.push(run)}}
 const running=currentByWorkflow.find(x=>['queued','in_progress','waiting','requested','pending'].includes(x.status));
 const failed=currentByWorkflow.find(x=>x.conclusion==='failure');
 const current=running||failed||currentByWorkflow[0];
 const state=releasePassed?'released':running?'running':failed?'failed':current?'checked':'unverified';
 let action=running?'GitHub Actions выполняет: ':failed?'Ошибка GitHub Actions: ':current?'Последняя проверка: ':'По текущему коммиту новых проверок нет';
 if(current)action+=current.name+(state==='checked'?' — '+String(current.conclusion||'ожидает'): '');
 if(running&&job?.runId===running.id)action+=' / '+job.name+(job.step?' / '+job.step:'');
 return {title:TASK.title,prUrl:'https://github.com/'+TASK.repo+'/pull/'+TASK.pr,sha,stages,passed,total:stages.length,percent:Math.round(100*passed/stages.length),state,action,runId:current?.id||null,runUrl:current?.id?'https://github.com/'+TASK.repo+'/actions/runs/'+current.id:null,releaseReady:releasePassed===true};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 const data={pr:null,audit:null,runs:[],job:null,parity:null,publication:null,prAt:0,auditAt:0,runsAt:0,jobAt:0,parityAt:0,publicationAt:0,error:'',busy:false};
 let queued=false,lastManual=0;
 const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
 const containers=()=>owner()?[owner().querySelector('#lw-owner-command .lw-cc-development-list'),owner().querySelector('#ow-workspace')].filter(Boolean):[];
 const create=(name,content,className)=>{const x=document.createElement(name);if(content!==undefined)x.textContent=String(content);if(className)x.className=className;return x};
 function mount(){if(!owner()){for(const panel of document.querySelectorAll('[data-owner-ci-status]'))panel.remove();return}for(const container of containers())if(!container.querySelector(':scope > [data-owner-ci-status]')){const x=create('section',undefined,'owner-ci-status');x.dataset.ownerCiStatus='';x.setAttribute('aria-label','Автоматический прогресс выпуска SH59');container.prepend(x);render(x)}}
 function render(panel){const status=summarize(data);panel.replaceChildren();
  const head=create('div',undefined,'owner-ci-head'),title=create('strong',status.title),badge=create('span',status.state==='released'?'Опубликовано':status.state==='running'?'Проверяется':status.state==='failed'?'Ошибка CI':'До выпуска','owner-ci-badge');badge.dataset.status=status.state;head.append(title,badge);panel.append(head);
  const progress=create('div',undefined,'owner-ci-progress');progress.append(create('span',status.passed+' из '+status.total+' подтверждённых этапов'),create('b',status.percent+'%'));panel.append(progress);
  const bar=create('div',undefined,'owner-ci-track');bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Подтверждённые этапы SH59');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(status.total));bar.setAttribute('aria-valuenow',String(status.passed));const fill=create('div',undefined,'owner-ci-fill');fill.style.width=status.percent+'%';bar.append(fill);panel.append(bar);
  const stages=create('ol',undefined,'owner-ci-stages');for(const s of status.stages){const item=create('li',(s.passed?'✓ ':'○ ')+s.label);item.dataset.passed=String(s.passed);stages.append(item)}panel.append(stages);
  panel.append(create('p',status.action,'owner-ci-action'));
  panel.append(create('small','Последний коммит PR: '+(status.sha?status.sha.slice(0,12):'не подтверждён')+'. Обновление PR: '+(data.pr?.updated_at?new Date(data.pr.updated_at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk'}):'неизвестно')+' (Минск).','owner-ci-note'));
  const last=data.runsAt?new Date(data.runsAt).toLocaleString('ru-RU',{timeZone:'Europe/Minsk'}):'ещё нет';
  panel.append(create('small','Источник: GitHub. Последняя проверка: '+last+'. Автообновление каждые 2 минуты.','owner-ci-note'));
  if(data.error)panel.append(create('p','Данные временно недоступны: '+data.error,'owner-ci-error'));
  panel.append(create('small','Процент — подтверждённые этапы, не оценка времени. Пока Codex не отправил изменения в GitHub, его команды здесь не видны.','owner-ci-note'));
  const actions=create('div',undefined,'owner-ci-actions');
  const link=(label,url)=>{const a=create('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a)};
  link('PR #'+TASK.pr,status.prUrl);if(status.runUrl)link('Проверка CI',status.runUrl);
  const refresh=create('button',data.busy?'Обновляю…':'Обновить сейчас');refresh.type='button';refresh.disabled=data.busy;refresh.addEventListener('click',()=>{if(Date.now()-lastManual>15000){lastManual=Date.now();void load(true)}});actions.append(refresh);panel.append(actions);
 }
 function paint(){mount();for(const container of containers())for(const panel of container.querySelectorAll(':scope > [data-owner-ci-status]'))render(panel)}
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount()})}
 async function api(path){const r=await fetch(ROOT+path,{credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
 const base=new URL(import.meta.url);const siteBase=base.pathname.includes('/test/')?new URL('../',base):new URL('./',base);
 async function served(path){const r=await fetch(new URL(path,siteBase),{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Site HTTP '+r.status);return r.json()}
 async function load(force=false){if(data.busy||!owner()||document.hidden)return;data.busy=true;paint();const now=Date.now(),errors=[],jobs=[];
  if(force||!data.pr||now-data.prAt>600000)jobs.push(api('pulls/'+TASK.pr).then(x=>{data.pr=x;data.prAt=Date.now()}).catch(e=>errors.push('PR '+e.message)));
  if(force||!data.audit||now-data.auditAt>86400000)jobs.push(api('actions/runs/'+TASK.audit).then(x=>{data.audit=x;data.auditAt=Date.now()}).catch(e=>errors.push('E2E '+e.message)));
  if(force||!data.runsAt||now-data.runsAt>115000)jobs.push(api('actions/runs?branch='+encodeURIComponent(data.pr?.head?.ref||'ci/sh59-verified-source-handoff-20261121')+'&per_page=50').then(x=>{data.runs=Array.isArray(x.workflow_runs)?x.workflow_runs:[];data.runsAt=Date.now()}).catch(e=>errors.push('CI '+e.message)));
  if(force||!data.parity||now-data.parityAt>120000)jobs.push(served('test/staging-manifest.json').then(x=>{data.parity=x;data.parityAt=Date.now()}).catch(e=>errors.push('Staging '+e.message)));
  if(force||!data.publication||now-data.publicationAt>600000)jobs.push(Promise.all([served('production-release-manifest.json'),served('build-info.json')]).then(([manifest,build])=>{data.publication={manifest,build,release:data.publication?.release||null};data.publicationAt=Date.now()}).catch(e=>errors.push('Production '+e.message)));
  await Promise.all(jobs);
  if(data.publication?.manifest?.businessVersion==='SH-01.30.59 v'&&
     (!data.publication.release||force||now-(data.publication.releaseCheckedAt||0)>600000)){
   try{
    const x=await api('actions/workflows/controlled-sh59-publish.yml/runs?per_page=10');
    const run=x.workflow_runs?.find(r=>r.event==='workflow_dispatch'&&r.conclusion==='success'&&r.status==='completed');
    if(run){const res=await api('actions/runs/'+run.id+'/jobs?per_page=30');
     data.publication.release={event:run.event,conclusion:run.conclusion,publishJob:res.jobs?.some(j=>j.name==='publish'&&j.conclusion==='success')===true};
    }else data.publication.release=null;
    data.publication.releaseCheckedAt=Date.now();
   }catch(e){errors.push('Release '+e.message)}
  }
  const result=summarize(data);if(result.state==='running'&&result.runId&&(force||data.job?.runId!==result.runId||now-data.jobAt>240000)){
   try{const x=await api('actions/runs/'+result.runId+'/jobs?per_page=30');const j=x.jobs?.find(k=>k.status==='in_progress')||x.jobs?.find(k=>k.conclusion==='failure');const step=j?.steps?.find(k=>k.status==='in_progress')||j?.steps?.find(k=>k.conclusion==='failure');data.job=j?{runId:result.runId,name:j.name,step:step?.name||''}:null;data.jobAt=Date.now()}catch(e){errors.push('шаг '+e.message)}
  }else if(result.state!=='running')data.job=null;
  data.error=errors.join('; ');data.busy=false;paint();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule();void load()}});
 for(const event of ['hashchange','freight-access-updated'])window.addEventListener(event,()=>{schedule();void load()});
 new MutationObserver(changes=>{if(changes.every(x=>x.target?.closest?.('[data-owner-ci-status]')))return;schedule()}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-cabinet-role']});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mount();void load()},{once:true});else{mount();void load()}
 setInterval(()=>{if(!document.hidden){mount();void load()}},120000);
}
