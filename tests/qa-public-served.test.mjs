import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectSummary} from '../scripts/qa-publication-gate.mjs';

const base='https://hakaru4i-afk.github.io/freight-quotes-web/test/';
const expected=fs.readFileSync(new URL('../test/qa-public-status.json',import.meta.url),'utf8');
async function get(path){
  let last;
  for(let i=0;i<12;i++){
    try{const r=await fetch(base+path+'?qa-verification='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const body=await r.text();if(body.length>0)return body;
    }catch(e){last=e}
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  throw last||Error('Pages unavailable');
}
test('published GitHub Pages serves exact de-identified QA summary',async()=>{
  const raw=await get('qa-public-status.json');
  assert.equal(raw,expected,'served report must match the committed bytes');
  const manifest=JSON.parse(raw);assert.deepEqual(inspectSummary(manifest),[]);
  assert.equal(manifest.production,'NOT_MODIFIED');
});
test('public status page and bundled JS/CSS are available and data-only',async()=>{
  const [html,script,style]=await Promise.all([get('qa-status.html'),get('qa-status.mjs'),get('qa-status.css')]);
  assert.match(html,/qa-public-status\.json/);
  assert.match(html,/Content-Security-Policy/);
  assert.match(script,/textContent/);
  assert.doesNotMatch(script,/innerHTML\s*=/);
  assert.match(style,/color-scheme/);
});
