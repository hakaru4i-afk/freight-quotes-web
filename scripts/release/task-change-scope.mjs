import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Only edits to ordinary CSS and changes to Markdown docs qualify.
// Executable modes, symlinks and mixed changes take the full test path.
export function lightweightChange(rawDiff) {
  if (!rawDiff || !rawDiff.endsWith('\0')) return false;
  const entries = rawDiff.slice(0,-1).split('\0');
  if (entries.length % 2 !== 0) return false;
  for (let index = 0; index < entries.length; index += 2) {
    const [metadata, path] = entries.slice(index,index+2);
    const file = /^:(000000|100644) (000000|100644) [0-9a-f]+ [0-9a-f]+ ([AMD])$/.exec(metadata);
    if (!file || /[\r\n]/.test(path)) return false;
    if (path.endsWith('.css') && file[3] === 'M') continue;
    if (path === 'README.md' || /^docs\/.+\.md$/.test(path)) continue;
    return false;
  }
  return true;
}

function git(args) {
  return execFileSync('git',args,{encoding:'utf8'});
}
function diff(base,head) {
  return git(['diff','--raw','-z','--no-renames','--no-ext-diff','--ignore-submodules=none',base,head,'--']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode,base,head] = process.argv.slice(2);
  if (!['classify','guard-main'].includes(mode) || ![base,head].every(sha=>/^[0-9a-f]{40}$/.test(sha))) {
    throw Error('INVALID_CHANGE_SCOPE_ARGUMENTS');
  }
  if (mode === 'classify') {
    console.log(lightweightChange(diff(base,head))?'lightweight':'full');
  } else if (base !== head) {
    git(['merge-base','--is-ancestor',base,head]);
    if (!lightweightChange(diff(base,head))) throw Error('FRONTEND_MAIN_MOVED_WITH_FULL_SCOPE_CHANGES');
    console.log('Keeping the verified frontend snapshot. Later CSS and Markdown changes remain on main.');
  }
}
