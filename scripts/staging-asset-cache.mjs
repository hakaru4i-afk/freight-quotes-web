// HTML entry cache keys are content hashes. Old human labels (including SH-…
// and encoded spaces) must be replaced completely, preserving other parameters.
function entries(html){return [...html.matchAll(/(?:src|href)="(\.\/[^"\s]+)"/g)];}
export function assertStagingReleaseLabels(status,primary){
 if(status.release?.version!==primary||![primary,primary+' · тестовая'].includes(status.releases?.[0]?.version))throw Error('STALE_VISIBLE_RELEASE_NOTES');
}
export function stampAssetReference(html,name,version,parameters={}){
 if(!/^[a-f0-9]{12}$/.test(version))throw Error('INVALID_CACHE_DIGEST');
 const matches=entries(html).filter(m=>m[1].split('?')[0]==='./'+name);
 if(matches.length!==1)throw Error('CACHE_ENTRY_NOT_UNIQUE:'+name);
 const before=matches[0][1],url=new URL(before,'https://cache.invalid/');
 url.searchParams.set('v',version);
 for(const [key,value] of Object.entries(parameters))url.searchParams.set(key,value);
 return html.replace('="'+before+'"','="./'+name+'?'+url.searchParams.toString()+'"');
}
export function stagingHtmlStructure(html){
 for(const match of entries(html)){
  const value=match[1],url=new URL(value,'https://cache.invalid/');
  if(!/\.(js|mjs|css)$/.test(url.pathname))continue;
  url.searchParams.delete('v');
  const query=url.searchParams.toString(),normalized='./'+url.pathname.slice(1)+(query?'?'+query:'');
  html=html.replace('="'+value+'"','="'+normalized+'"');
 }
 return html;
}
export function normalizeModuleCacheImports(source){
 return source.replace(/((?:from\s*|import\s*\()\s*['"])(\.\/[^'"\s]+\.mjs)(\?[^'"]+)(['"])/g,(_,prefix,path,query,quote)=>{
  const params=new URLSearchParams(query.slice(1));params.delete('v');
  const rest=params.toString();return prefix+path+(rest?'?'+rest:'')+quote;
 });
}
