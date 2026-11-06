// Regenerate only the document module assets and existing staging bundle references.
// --component also applies the readable canonical carrier component to its guarded bundle slot.
import fs from 'node:fs';import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url), path=name=>new URL(name,base);
const read=name=>fs.readFileSync(path(name),'utf8'), write=(name,text)=>fs.writeFileSync(path(name),text);
const sha=data=>createHash('sha256').update(data).digest('hex');
let app=read('test/app.js');
if(process.argv.includes('--component')){
 const start=app.indexOf('function Ky({'),end=app.indexOf('function eb(',start);
 if(start<0||end<=start)throw Error('Canonical carrier document component slot changed; inspect source first');
 app=app.slice(0,start)+read('tests/issue17-carrier-component.js')+app.slice(end);
}
const model=read('test/transport-application-model.mjs'), modelName='transport-application-model-'+sha(model).slice(0,12)+'.mjs';
write('test/'+modelName,model);
const editor=read('test/transport-application-editor.mjs').replace(/\.\/transport-application-model(?:-[a-f0-9]{12})?\.mjs/g,'./'+modelName);
write('test/transport-application-editor.mjs',editor);
const editorName='transport-application-editor-'+sha(editor).slice(0,12)+'.mjs';write('test/'+editorName,editor);
app=app.replace(/\.\/transport-application-model(?:-[a-f0-9]{12})?\.mjs/g,'./'+modelName).replace(/\.\/transport-application-editor(?:-[a-f0-9]{12})?\.mjs/g,'./'+editorName);
write('test/app.js',app);
const blob=createHash('sha1').update('blob '+Buffer.byteLength(app)+'\0').update(app).digest('hex');
const info=JSON.parse(read('test/build-info.json'));info.servedAppBlobSha=blob;
info.carrierDocument.moduleAssets=[modelName,editorName];
info.carrierDocument.files=Object.fromEntries(['app.js','transport-application-model.mjs','transport-application-editor.mjs','transport-application.css',modelName,editorName].map(name=>[name,sha(fs.readFileSync(path('test/'+name)))]));
write('test/build-info.json',JSON.stringify(info,null,2)+'\n');
write('test/index.html',read('test/index.html').replace(/app\.js\?v=[a-f0-9]+/,'app.js?v='+blob.slice(0,12)));
console.log('Document assets:',modelName,editorName,'app blob',blob);
