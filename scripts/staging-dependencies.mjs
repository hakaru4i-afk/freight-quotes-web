import {existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const roots = ['test', 'docs', 'scripts', 'tests', '.github/workflows'];
const optionalRoot = 'config';
const excluded = new Set([
  'test/staging-manifest.json',
  'test/alignment-role-help.json',
  'test/qa-robot-latest.json',
  'test/qa-release-readiness.json'
]);
const extensions = /\.(?:js|mjs|css|html|json|md|ya?ml|png|jpe?g|svg|webp|woff2?|ttf|otf)$/;

export function stagingDependencyPaths(root) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(resolve(root, directory), {withFileTypes: true})) {
      const path = directory + '/' + entry.name;
      if (path === 'test/process-history' || path === 'test/processes') continue;
      if (entry.isDirectory()) visit(path);
      else if (extensions.test(path) && !excluded.has(path)) {
        if (!entry.isFile()) throw Error('INVALID_DEPENDENCY_FILE:' + path);
        files.push(path);
      }
    }
  }
  for (const name of roots) visit(name);
  if (existsSync(resolve(root, optionalRoot))) visit(optionalRoot);
  return files.sort();
}

export function isStagingDependencyPath(path) {
  return !path.includes('\\') && path.split('/').every(part => part && part !== '.' && part !== '..') &&
    [...roots, optionalRoot].some(root => path.startsWith(root + '/'));
}
