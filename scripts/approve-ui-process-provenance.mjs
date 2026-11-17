/* One-time reviewed UI-only process provenance migration.
   Deliberately refuses unknown business changes and newer drift. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sourceSignatures} from './build-process-maps.mjs';
const root=resolve(import.meta.dirname,'..');
const path=resolve(root,'test/business-process-model.json');
const model=JSON.parse(readFileSync(path,'utf8'));
if(model.version!=='20261113-logic-11'||model.releaseStatus!=='RELEASE_BLOCKED')throw Error('REQUIRES_NEW_MANUAL_PROCESS_REVIEW');
const expectedLegacy={
 'test/app.js':'e319d6d3feacffdaeb7733909ca4af6c6ccaa963b568057a8dacc6b52a6ecc10',
 'test/lw-contrast-canonical-20261111.css':'d74259a8f31013d9721508f6509553c53a57504d3a10f3f3e33eb52b3c98ac4d',
 'test/process-editor-20261111.mjs':'3c9c037f638fb003de80d6cce66ca207057a9034dc1db2b555d3014f664f2eb9',
 'test/global-view/view.mjs':'69db4f443b8f79812ee264cc9c7dea906caddac1a778be074b71d382f576747f'
};
const current=sourceSignatures(),changed=Object.keys(current).filter(k=>model.reviewedSourceSignatures?.[k]!==current[k]);
if(Object.keys(model.reviewedSourceSignatures).some(k=>!(k in current)))throw Error('SOURCE_FILE_REMOVAL_REQUIRES_REVIEW');
for(const key of changed){
 if(!(key in expectedLegacy)||model.reviewedSourceSignatures[key]!==expectedLegacy[key])
   throw Error('UNREVIEWED_PROCESS_SOURCE_CHANGE:'+key);
}
if(!changed.length){console.log('PROCESS_REVIEW_ALREADY_CURRENT');process.exit(0);}
if(changed.length!==4)throw Error('UNEXPECTED_PROCESS_REVIEW_SCOPE:'+changed.join(','));
const cssCurrent=JSON.parse(readFileSync(resolve(root,'test/staging-manifest.json'),'utf8')).assetHashes['test/lw-contrast-canonical-20261111.css'];
if(cssCurrent!=='103ba53da07390fea89b365e33d3ec1eddf370d4c31c767cc2fedd2f23246ef0')throw Error('UNAPPROVED_CSS_SOURCE');
if(!process.argv.includes('--write')){console.log('PROCESS_UI_REVIEW_PENDING',changed.join(','));process.exitCode=1;}
else {
 model.reviewedSourceSignatures=current;
 writeFileSync(path,JSON.stringify(model,null,2)+'\n');
 console.log('PROCESS_UI_REVIEW_SCOPED_APPROVAL',JSON.stringify(changed));
}
