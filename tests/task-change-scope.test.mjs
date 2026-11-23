import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lightweightChange} from '../scripts/release/task-change-scope.mjs';

const classifier = fileURLToPath(new URL('../scripts/release/task-change-scope.mjs',import.meta.url));
const record = (path,{status='M',oldMode='100644',newMode='100644'}={}) =>
  ':'+oldMode+' '+newMode+' aaaaaaa bbbbbbb '+status+'\0'+path+'\0';

test('only edits to ordinary CSS and changes to Markdown docs qualify',()=>{
  const small = record('style.css')+record('docs/Owner guide.md',{status:'A',oldMode:'000000'});
  assert.equal(lightweightChange(small),true);
  for (const unsafe of [
    '',record('src/api.mjs'),record('test/build-info.json'),record('test/help.html'),
    record('.github/workflows/guide.md'),record('test/style.css',{status:'D',newMode:'000000'}),
    record('test/style.css',{newMode:'120000'}),record('docs/guide.md',{newMode:'100755'}),
    small+record('app.js'),record('style.css').slice(0,-1)
  ]) assert.equal(lightweightChange(unsafe),false);
});

test('release guard permits CSS advances on main and rejects code changes and rewrites',t=>{
  const cwd=mkdtempSync(join(tmpdir(),'freight-task-scope-'));
  t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  function commit(file,body){
    writeFileSync(join(cwd,file),body);
    git('add',file);
    git('-c','user.name=Test','-c','user.email=test@example.test','commit','-m',file);
    return git('rev-parse','HEAD');
  }
  const run=(mode,base,head)=>spawnSync(process.execPath,[classifier,mode,base,head],{cwd,encoding:'utf8'});
  git('init','-q');
  const pinned=commit('style.css','body {color: black}');
  const css=commit('style.css','body {color: navy}');
  assert.equal(run('classify',pinned,css).stdout.trim(),'lightweight');
  assert.equal(run('guard-main',pinned,css).status,0);
  const mixed=commit('app.js','void 0;');
  assert.equal(run('classify',pinned,mixed).stdout.trim(),'full');
  assert.notEqual(run('guard-main',pinned,mixed).status,0);
  assert.notEqual(run('guard-main',css,pinned).status,0);
});
