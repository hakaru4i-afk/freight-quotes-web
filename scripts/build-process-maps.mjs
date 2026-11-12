import {processEdges as edges} from "../test/process-model-graph.mjs";
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrap=(s,n=28)=>{const out=[];let line='';for(const w of String(s).split(/\s+/)){if((line+' '+w).trim().length>n&&line){out.push(line);line=w;}else line=(line+' '+w).trim();}if(line)out.push(line);return out;};
const watchedSources=[...new Set([...readFileSync(resolve(root,'test/index.html'),'utf8').matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"\s]*)?"/g)].map(x=>'test/'+x[1]).concat('test/process-model-graph.mjs','test/process-model-diff.mjs','test/task2-panel.js'))];
function sourceSignatures(){return Object.fromEntries(watchedSources.map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')]));}
function backendSource(){return JSON.parse(readFileSync(resolve(root,'test/build-info.json'),'utf8')).stabilizationQa20261110.backendSourceCommit;}
export function assertSourcesCurrent(model){if(model.reviewedBackendSourceCommit!==backendSource())throw Error('Backend source changed without reviewed map');for(const [path,sha] of Object.entries(sourceSignatures()))if(model.reviewedSourceSignatures?.[path]!==sha)throw Error('Process source changed without reviewed map: '+path);}
export function validate(model){
 if(model.releaseStatus!=='RELEASE_BLOCKED')throw Error('Map does not authorize release');
 const ids=new Set();for(const p of model.processes){if(ids.has(p.id))throw Error('Duplicate process');ids.add(p.id);
  if(!['LOGIC_OK','LOGIC_IMPROVED','LOGIC_PROBLEM','APPROVAL_REQUIRED','BLOCKED'].includes(p.logicStatus))throw Error('Unknown logic status');
  for(const key of ['agreed','actual','optimal','exceptions','risks','verification'])if(!p[key])throw Error('Incomplete process '+p.id);
  for(const node of p.nodes)if(!model.roles[node.role])throw Error('Unknown role '+node.role);
 }
 if(ids.size!==10)throw Error('Expected ten reviewed processes');
}

function graph(model,processes,perspective=null){
 processes=processes.map(p=>({...p,nodes:p.nodes.map(n=>({...n,role:n.alsoRoles?.includes(perspective)?perspective:n.role}))}));
 const used=Object.keys(model.roles).filter(r=>processes.some(p=>p.nodes.some(n=>n.role===r)));
 const width=Math.max(390,used.length*310+40),nodes=[],links=[],groups=[];let y=80;
 for(const p of processes){groups.push({y,title:p.id+' · '+p.title});y+=55;const start=nodes.length;
  for(const n of p.nodes){nodes.push({...n,x:30+used.indexOf(n.role)*310,y,w:270,h:140,process:p.id});y+=190;}
  for(const edge of edges(p)){const a=nodes[start+edge.from],b=nodes[start+edge.to];links.push({...edge,source:a.id,target:b.id,x1:a.x+a.w/2,y1:a.y+a.h,x2:b.x+b.w/2,y2:b.y});}
  y+=50;
 }
 return {width,height:y,roles:used,nodes,links,groups};
}
function svg(model,processes,title,perspective=null){
 const g=graph(model,processes,perspective);
 const lanes=g.roles.map((r,i)=>`<rect x="${20+i*310}" y="0" width="300" height="${g.height}" fill="${i%2?'#eff6ff':'#f8fafc'}"/><text x="${170+i*310}" y="34" text-anchor="middle" font-size="18" font-weight="700">${esc(model.roles[r])}</text>`).join('');
 const arrows=g.links.map(e=>`<path d="M${e.x1},${e.y1} V${e.y1+22} H${e.x2} V${e.y2-6}" fill="none" stroke="#53667c" stroke-width="2" marker-end="url(#arrow)"/><text x="${Math.min(e.x1,e.x2)+5}" y="${e.y1+38}" font-size="12">${esc(e.label)}</text>`).join('');
 const nodes=g.nodes.map(n=>`<g id="${esc(n.id)}"><title>${esc(n.detail)}</title><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="white" stroke="${n.role==='system'?'#07806d':'#365dad'}" stroke-width="2"/>${wrap(n.title).map((l,i)=>`<text x="${n.x+15}" y="${n.y+27+i*23}" font-size="17" font-weight="600">${esc(l)}</text>`).join('')}<text x="${n.x+15}" y="${n.y+103}" font-size="13" fill="#35465b">${esc(n.status)}</text><text x="${n.x+15}" y="${n.y+123}" font-size="12" fill="#35465b">${esc(n.id)}</text></g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title" viewBox="0 0 ${g.width} ${g.height}"><title id="title">${esc(title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#53667c"/></marker></defs><g font-family="system-ui,sans-serif" fill="#142c45">${lanes}${g.groups.map(x=>`<text x="30" y="${x.y+20}" font-size="16" font-weight="700">${esc(x.title)}</text>`).join('')}${arrows}${nodes}</g></svg>\n`;
}
function drawio(model,processes=model.processes,name=model.version,perspective=null){
 const g=graph(model,processes,perspective);let cells='<mxCell id="0"/><mxCell id="1" parent="0"/>';
 for(const [i,role] of g.roles.entries())cells+=`<mxCell id="lane-${role}" value="${esc(model.roles[role])}" style="swimlane;horizontal=1;startSize=45;fillColor=#f1f5f9;" vertex="1" parent="1"><mxGeometry x="${20+i*310}" y="0" width="300" height="${g.height}" as="geometry"/></mxCell>`;
 for(const n of g.nodes)cells+=`<mxCell id="${n.id}" value="${esc(n.title+'\n'+n.status+'\n'+n.detail)}" style="rounded=1;whiteSpace=wrap;html=0;fillColor=#ffffff;strokeColor=#365dad;" vertex="1" parent="lane-${n.role}"><mxGeometry x="10" y="${n.y}" width="270" height="140" as="geometry"/></mxCell>`;
 for(const [i,e] of g.links.entries())cells+=`<mxCell id="edge-${i}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;" edge="1" parent="1" source="${e.source}" target="${e.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
 return `<mxfile host="app.diagrams.net"><diagram id="${esc(name)}" name="${esc(name)}"><mxGraphModel page="0"><root>${cells}</root></mxGraphModel></diagram></mxfile>\n`;
}
export function outputs(model){
 validate(model);const files=new Map();const hash=createHash('sha256').update(JSON.stringify(model)).digest('hex');
 const mainRoles={P01:'owner',P02:'carrier',P03:'owner',P04:'carrier',P05:'carrier',P06:'logistic',P07:'supplier',P08:'content',P09:'owner',P10:'system'};
 const overviewProcess={id:'OVERVIEW',title:'Взаимосвязи процессов; поставка/контент и назначения — отдельные ветви',nodes:model.processes.map(p=>({id:'summary-'+p.id,role:mainRoles[p.id],title:p.id+' · '+p.title,status:p.logicStatus,detail:p.agreed})),edges:model.overview.map(([a,b,label])=>({from:model.processes.findIndex(p=>p.id===a),to:model.processes.findIndex(p=>p.id===b),label}))};
 files.set('test/business-process-current.svg',svg(model,[overviewProcess],'Общая схема портала'));
 files.set('test/processes/all-details.svg',svg(model,model.processes,'Все детальные процессы'));
 const pages=[[overviewProcess],...model.processes.map(p=>[p]),...Object.keys(model.roles).map(role=>model.processes.filter(p=>p.nodes.some(n=>n.role===role||n.alsoRoles?.includes(role))))];
 files.set('test/business-process-current.drawio','<mxfile host="app.diagrams.net">'+pages.map((ps,i)=>drawio(model,ps,i===0?'Общая схема':i<=10?ps[0].title:'Кабинет '+model.roles[Object.keys(model.roles)[i-11]],i>10?Object.keys(model.roles)[i-11]:null).replace(/^<mxfile[^>]*>/,'').replace(/<\/mxfile>\n$/,'')).join('')+'</mxfile>\n');
 for(const p of model.processes)files.set('test/processes/'+p.id+'.svg',svg(model,[p],p.title));
 for(const role of Object.keys(model.roles))files.set('test/processes/cabinet-'+role+'.svg',svg(model,model.processes.filter(p=>p.nodes.some(n=>n.role===role||n.alsoRoles?.includes(role))),model.roles[role],role));
 const overview=[['P01','P02','Опубликованная заявка'],['P02','P03','Предложения'],['P03','P04','Один победитель'],['P04','P05','Принятие и выход'],['P05','P06','Подтверждённые <1000 км'],['P06','P05','Документы проверены'],['P05','P09','Этапы и задачи завершены'],['P02','P10','Контроль дедлайна'],['P10','P03','Допуск и история SL']];
 files.set('test/processes/overview.mmd','flowchart TB\n'+model.processes.map(p=>`${p.id}["${p.id} ${p.title}"]`).join('\n')+'\n'+overview.map(([a,b,label])=>`${a} -->|${label}| ${b}`).join('\n')+'\n');
 // Public page contains only agreed workflow descriptions, no accounts, business records or private evidence.
 const sections=model.processes.map(p=>`<section id="${p.id}" data-roles="${[...new Set(p.nodes.flatMap(n=>[n.role,...(n.alsoRoles||[])]))].join(' ')}"><h2>${esc(p.id+' · '+p.title)}</h2><p class="status">${p.logicStatus} · TECH: ${p.technicalStatus}</p>${[['Согласовано',p.agreed],['Сейчас',p.actual],['Предлагаю',p.optimal],['Исключения и возвраты',p.exceptions],['Риски',p.risks],['Проверка',p.verification]].map(([k,v])=>`<p><b>${k}:</b> ${esc(v)}</p>`).join('')}<details><summary>Схема по дорожкам ролей</summary><div class="diagram">${svg(model,[p],p.title)}</div><p><a href="processes/${p.id}.svg">Скачать SVG</a></p></details></section>`).join('');
 const roleOptions=Object.entries(model.roles).filter(([id])=>id!=='system').map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('');
 const overviewList=model.processes.map(p=>`<li><a href="#${p.id}">${esc(p.id+' · '+p.title)}</a></li>`).join('');
 files.set('test/process-map.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Бизнес-процессы портала</title><style>body{font:16px/1.55 system-ui;margin:auto;max-width:1100px;padding:24px;color:#172b43;background:#f5f8fc}a{color:#204ead}section,header{padding:24px;margin:16px 0;background:white;border:1px solid #cad5e3;border-radius:12px}h1{font-size:28px}h2{font-size:22px}select{font:inherit;max-width:100%;padding:8px}.status{font-weight:bold;color:#784500}.diagram{overflow:auto;max-height:75vh;border:1px solid #cad5e3}.diagram svg{display:block;min-width:700px;width:100%;height:auto}summary{cursor:pointer;font-weight:600}li{margin:8px 0}[hidden]{display:none!important}@media(max-width:500px){body{padding:10px}section,header{padding:16px}h1{font-size:24px}}</style><header><h1>Бизнес-процессы портала</h1><p>Редакция ${model.date}. ${esc(model.scope)}</p><p><b>RELEASE_BLOCKED.</b> Технический PASS и корректность бизнес-логики оцениваются отдельно. PARTIAL не означает готовность.</p><ul>${model.decisions.map(d=>`<li>${esc(d)}</li>`).join('')}</ul><p><a href="business-process-current.drawio">Редактируемая схема draw.io</a> · <a href="business-process-current.svg">Все дорожки SVG</a> · <a href="process-history/process-map-20261107.html">Редакция 07.11</a>${model.previousVersion?' · <a href="process-history/'+esc(model.previousVersion)+'/process-map.html">Предыдущая редакция</a>':''}</p><label>Кабинет <select id="role"><option value="all">Все процессы</option>${roleOptions}</select></label><p id="cabinet-link"></p><nav aria-label="Процессы"><ol>${overviewList}</ol></nav><details><summary>Общая схема взаимосвязей</summary><div class="diagram">${svg(model,[overviewProcess],'Общая схема портала')}</div></details><p>Основной цикл: заявка → ставки → выбор → принятие → трекинг ↔ проверка документов → завершение. SL проверяется параллельно. Поставка и контент — отдельная цепочка, не дополнительный обязательный этап перевозки.</p></header>${sections}<footer>Модель ${model.version} · SHA256 ${hash.slice(0,16)}. <a href="business-process-model.json">Исходная модель</a></footer><script>document.getElementById('role').addEventListener('change',function(){for(const section of document.querySelectorAll('section[data-roles]'))section.hidden=this.value!=='all'&&!section.dataset.roles.split(' ').includes(this.value);for(const link of document.querySelectorAll('nav a[href^=\"#P\"]'))link.parentElement.hidden=document.querySelector(link.getAttribute('href')).hidden;const root=document.getElementById('cabinet-link');root.replaceChildren();if(this.value!=='all'){const a=document.createElement('a');a.href='processes/cabinet-'+this.value+'.svg';a.textContent='Отдельная схема кабинета (SVG)';root.append(a);}});</script></html>\n`);
 files.set('test/processes/manifest.json',JSON.stringify({version:model.version,modelSha256:hash,modelSnapshot:model,files:[...files.keys()].map(p=>p.replace(/^test\//,''))},null,2)+'\n');
 return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const modelPath=resolve(root,'test/business-process-model.json');
 const model=JSON.parse(readFileSync(modelPath,'utf8'));const check=process.argv.includes('--check');
 if(process.argv.includes('--record-reviewed-sources')){
  const manifestPath=resolve(root,'test/processes/manifest.json');
  if(existsSync(manifestPath)){
   const previous=JSON.parse(readFileSync(manifestPath,'utf8'));
   if(previous.version!==model.version){
    if(!previous.modelSnapshot)throw Error('Missing previous model snapshot; preserve history before changing version');
    const archive=resolve(root,'test/process-history',previous.version);mkdirSync(archive,{recursive:true});
    for(const name of previous.files){const target=resolve(archive,name);mkdirSync(dirname(target),{recursive:true});let bytes=readFileSync(resolve(root,'test',name));if(name==='process-map.html')bytes=Buffer.from(bytes.toString('utf8').replaceAll('href="process-history/','href="../'));writeFileSync(target,bytes);}
    writeFileSync(resolve(archive,'business-process-model.json'),JSON.stringify(previous.modelSnapshot,null,2)+'\n');
   }
  }
  model.reviewedSourceSignatures=sourceSignatures();model.reviewedBackendSourceCommit=backendSource();writeFileSync(modelPath,JSON.stringify(model,null,2)+'\n');}
 assertSourcesCurrent(model);
 for(const [path,content] of outputs(model)){const target=resolve(root,path);if(check){if(readFileSync(target,'utf8')!==content)throw Error('Stale diagram: '+path);}else{mkdirSync(dirname(target),{recursive:true});writeFileSync(target,content);}}
 console.log(check?'PROCESS_MAPS_CURRENT':'PROCESS_MAPS_GENERATED');
}
