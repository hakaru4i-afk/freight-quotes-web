// Package only reviewed static assets; no repository internals or credentials.
import{readFileSync,writeFileSync,readdirSync,mkdirSync,rmSync,cpSync,lstatSync,existsSync}from'node:fs';
import{join,resolve,relative,sep,dirname}from'node:path';
import{createHash}from'node:crypto';
const root=process.cwd(),out=resolve(root,'.release-pages');
const version=process.env.PORTAL_RELEASE_VERSION||'',fe=process.env.GITHUB_SHA||'',be=process.env.PORTAL_BACKEND_SHA||'';
if(!/^SH-\d{2}\.\d{2}\.\d{2} v$/.test(version)||!(/^[a-f0-9]{40}$/.test(fe)&&/^[a-f0-9]{40}$/.test(be)))throw Error('MISSING_VERIFIED_RELEASE_IDENTITY');
if(readFileSync('portal-feedback-center-20261107.js','utf8')!==readFileSync('test/portal-feedback-center-20261107.js','utf8'))throw Error('ROOT_TEST_RELEASE_UI_MISMATCH');
const sha=data=>createHash('sha256').update(data).digest('hex');
const staticFiles=/\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
const dirs=new Set(['test','global-view','processes','process-history']);
const forbidden=/(?:^|\/)(?:node_modules|reports|scripts|tests|docs|config|release|\.git|\.github|\.release-pages)(?:\/|$)|(?:^|[-_.])(?:secret|private-key|credential|session-token|password|database-url)(?:[-_.]|$)/i;
const files=[];
function copy(abs){
 const rel=relative(root,abs).split(sep).join('/');
 if(!rel||rel.startsWith('..')||forbidden.test(rel))throw Error('UNSAFE_PAGE_ASSET:'+rel);
 const st=lstatSync(abs);
 if(st.isSymbolicLink())throw Error('SYMLINK_REJECTED:'+rel);
 if(st.isDirectory()){for(const item of readdirSync(abs))copy(join(abs,item));return;}
 if(!st.isFile()||(!staticFiles.test(rel)&&rel!=='.nojekyll'))return;
 const target=resolve(out,rel);
 if(!target.startsWith(out+sep))throw Error('PATH_ESCAPE');
 mkdirSync(dirname(target),{recursive:true});cpSync(abs,target);files.push(rel);
}
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const name of readdirSync(root)){
 if(name==='.nojekyll'){copy(resolve(root,name));continue;}
 if(name.startsWith('.'))continue;
 const p=resolve(root,name),st=lstatSync(p);
 if(st.isDirectory()){if(dirs.has(name))copy(p);continue;}
 if(staticFiles.test(name))copy(p);
}
for(const required of ['index.html','test/index.html','portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js'])if(!files.includes(required))throw Error('RELEASE_ASSET_MISSING:'+required);
const candidateFile=resolve(root,'release/owner-portal-feedback-center-20261122.js');
if(!existsSync(candidateFile))throw Error('OWNER_RELEASE_CANDIDATE_MISSING');
const candidate=readFileSync(candidateFile,'utf8');
if(!candidate.includes("action:'release_update'")||!candidate.includes('?releaseProgress='))
 throw Error('OWNER_RELEASE_ACTION_NOT_IN_REVIEWED_CANDIDATE');
// Promote only into the immutable-to-be-published artifact, never mutate
// a committed, currently served production file or its historical manifest.
writeFileSync(resolve(out,'portal-feedback-center-20261107.js'),candidate);
writeFileSync(resolve(out,'test/portal-feedback-center-20261107.js'),candidate);

const latest=JSON.parse(readFileSync('release-status.json','utf8')),info=JSON.parse(readFileSync('build-info.json','utf8')),site=JSON.parse(readFileSync('site-status.json','utf8'));
if(info.environment!=='production'||latest.status!=='released'||!latest.version)throw Error('CURRENT_PRODUCTION_VERSION_UNVERIFIED');
const build=sha(fe+be+version).slice(0,20);
const release={version,date:new Date().toISOString().slice(0,10),title:'Обновление Центра доработок',changes:['Запуск проверки и публикации по решению Владельца','Проверки и реальные состояния GitHub Actions','Инструкции RU/EN/ZH и журнал операций']};
info.releaseVersion=version;info.releaseStatus='PUBLISHED';info.environment='production';info.version=build;info.build=build;info.frontendSourceCommit=fe;info.backendSourceCommit=be;
latest.version=version;latest.date=release.date;latest.status='released';latest.changes=release.changes;
site.version=build;site.environment='production';site.maintenance=false;site.release=release;
site.releases=[release,...(site.releases||[]).filter(x=>x.version!==version)].slice(0,100);
for(const[name,obj]of [['build-info.json',info],['release-status.json',latest],['site-status.json',site]])
 writeFileSync(resolve(out,name),JSON.stringify(obj,null,2)+'\n');
const hashes={};
for(const file of files.filter(p=>!['production-release-manifest.json','build-info.json','release-status.json','site-status.json'].includes(p)))
 hashes[file]=sha(readFileSync(resolve(out,file)));
writeFileSync(resolve(out,'production-release-manifest.json'),JSON.stringify({schemaVersion:2,environment:'production',businessVersion:version,frontendBuild:build,frontendSourceCommit:fe,backendSourceCommit:be,assets:hashes,releaseStatus:'PUBLISHED',publishedAt:new Date().toISOString()},null,2)+'\n');
const html=readFileSync(resolve(out,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g))
 if(!existsSync(resolve(out,m[1])))throw Error('BROKEN_PRODUCTION_REFERENCE:'+m[1]);
console.log('OWNER_PAGES_CANDIDATE_BUILT',version,build,files.length,'assets; NOT_DEPLOYED');
