import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,lstatSync,rmSync} from 'node:fs';
import {resolve,join,relative,sep,extname} from 'node:path';
import {assertProductionReleaseIntegrity} from '../../tests/helpers/production-release-boundary.mjs';

const root=process.cwd(),output=resolve(root,'.release-pages');
const manifest=assertProductionReleaseIntegrity(root);
if(!/^SH-\d{2}\.\d{2}\.\d{2} v$/.test(process.env.RELEASE_VERSION||'')||manifest.businessVersion!==process.env.RELEASE_VERSION)throw Error('ONLY_EXACT_VERIFIED_RELEASE_MAY_BE_PACKAGED');
if(!manifest.assets||Object.keys(manifest.assets).length<4)throw Error('INCOMPLETE_PRODUCTION_ASSET_MANIFEST');
const allowed=/\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
const publicDirs=new Set(['test','global-view','processes','process-history']);
const sensitive=/^(?:node_modules|reports|scripts|tests|docs|config|release|\.git|\.github|\.release-pages)$/;
const forbidden=/(?:^|[-_.])(?:secret|private-key|credential|session-token|password|database-url)(?:[-_.]|$)/i;
const copy=(path)=>{
 const rel=relative(root,path).split(sep).join('/');
 if(rel.startsWith('..')||rel==='')throw Error('UNSAFE_STATIC_ASSET_PATH:'+rel);
 const st=lstatSync(path);
 if(st.isSymbolicLink())throw Error('SYMLINK_IN_PUBLIC_ARTIFACT:'+rel);
 if(st.isDirectory()){
   if(rel.split('/').some(part=>sensitive.test(part)))return;
   for(const entry of readdirSync(path))copy(join(path,entry));
   return;
 }
 if(!st.isFile()||forbidden.test(rel))throw Error('UNREVIEWED_PUBLIC_ASSET:'+rel);
 if(!allowed.test(rel)&&rel!=='.nojekyll')return;
 const to=resolve(output,rel);
 if(!to.startsWith(output+sep))throw Error('ASSET_ESCAPE');
 mkdirSync(resolve(to,'..'),{recursive:true});
 cpSync(path,to,{dereference:false});
};
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});
for(const entry of readdirSync(root)){
 if(entry==='.nojekyll'){copy(resolve(root,entry));continue}
 if(entry.startsWith('.'))continue;
 const p=resolve(root,entry),st=lstatSync(p);
 if(st.isDirectory()){if(publicDirs.has(entry))copy(p);continue}
 if(allowed.test(entry)&&!forbidden.test(entry))copy(p);
}
for(const name of Object.keys(manifest.assets)){
 if(!existsSync(resolve(output,name)))throw Error('MISSING_MANIFEST_PUBLIC_ASSET:'+name);
}
if(!existsSync(resolve(output,'index.html'))||!existsSync(resolve(output,'test/index.html')))throw Error('FRONTEND_OR_QA_ENTRYPOINT_MISSING');
const html=readFileSync(resolve(output,'index.html'),'utf8');
for(const [,filename] of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g))
 if(!existsSync(resolve(output,filename)))throw Error('BROKEN_RUNTIME_ASSET:'+filename);
console.log('REVIEWED_STATIC_PAGES_PACKAGE_READY; source remains unchanged; not yet deployed');
