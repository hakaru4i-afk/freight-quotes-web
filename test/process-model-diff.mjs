import {processEdges} from './process-model-graph.mjs?v=04007ed16b1f';
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export function diffProcessModels(before,after){
 const changes=[];for(const field of ['version','scope','decisions'])if(JSON.stringify(stable(before[field]))!==JSON.stringify(stable(after[field])))changes.push({process:'MODEL',field,before:before[field],after:after[field]});const roles=Object.keys(before.roles),value=(n,key,i)=>key==='position'?(n.position||{x:60+roles.indexOf(n.role)*260,y:70+i*130}):(n[key]??'');
 for(const p of after.processes){const old=before.processes.find(x=>x.id===p.id);if(!old){changes.push({process:p.id,field:'process',before:null,after:p.title});continue;}
  for(const field of ['title','agreed'])if(p[field]!==old[field])changes.push({process:p.id,field,before:old[field],after:p[field]});
  for(const n of old.nodes)if(!p.nodes.some(x=>x.id===n.id))changes.push({process:p.id,node:n.id,field:'removed',before:n.title,after:null});
  for(const [i,n]of p.nodes.entries()){const oi=old.nodes.findIndex(x=>x.id===n.id),previous=old.nodes[oi];if(!previous){changes.push({process:p.id,node:n.id,field:'added',before:null,after:n.title});continue;}
   for(const field of ['title','role','assignee','detail','type','status','position']){const a=value(previous,field,oi),b=value(n,field,i);if(JSON.stringify(stable(a))!==JSON.stringify(stable(b)))changes.push({process:p.id,node:n.id,field,before:a,after:b});}}
  const edges=m=>(m.edges||processEdges(m).map(e=>({from:m.nodes[e.from].id,to:m.nodes[e.to].id,condition:e.label||''}))).map(e=>stable({from:e.from,to:e.to,condition:e.condition||''})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(JSON.stringify(edges(old))!==JSON.stringify(edges(p)))changes.push({process:p.id,field:'transitions',before:edges(old),after:edges(p)});
 }return changes;
}
