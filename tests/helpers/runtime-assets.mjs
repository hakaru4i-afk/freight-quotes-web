import {readFileSync} from 'node:fs';import{createHash}from'node:crypto';
// Verify exact current content identity; human cache labels are historical only.
export function runtimeAssetUrl(name){const b=readFileSync(new URL('../../test/'+name,import.meta.url));return './'+name+'?v='+createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex').slice(0,12);}
