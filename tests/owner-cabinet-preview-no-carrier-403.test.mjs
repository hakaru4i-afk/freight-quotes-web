import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const path of ['app.js','test/app.js']) {
 test(path+' does not request owner-only cabinet list for a carrier or other staff member',()=>{
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const roleGate='fetch("/api/session?owner-check=1")';
  const deniedBranch='if(E?.role!=="owner"){c(null);return null}';
  const ownerOnly='return fetch("/api/test-cabinets")';
  assert.ok(source.includes(roleGate),'actual session role is checked first');
  assert.ok(source.includes(deniedBranch),'non-owner never enters owner fetch branch');
  assert.ok(source.includes(ownerOnly),'owner-only API still works for the owner');
  const gate=source.indexOf(roleGate),denied=source.indexOf(deniedBranch,gate),privileged=source.indexOf(ownerOnly,denied);
  assert.ok(gate>=0&&denied>gate&&privileged>denied&&privileged-denied<120,'request is guarded');
  assert.ok(!source.includes('return fetch("/api/test-cabinets").then(E=>E.ok?E.json():null)'),'unconditional previous request is gone');
  assert.ok(source.includes('!i.startsWith("/api/session?owner-check=1")&&h.set("x-freight-preview-login",d)'),'actual role check cannot accidentally inherit owner preview header');
 });
}
