#!/usr/bin/env node
// Read-only release consistency check. Does not contact APIs or write files.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const readText = (path) => readFileSync(resolve(root, path), 'utf8');
const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice(9);
const errors = [];
if (target !== undefined && !/^\d+\.\d+\.\d+$/.test(target)) errors.push('Invalid --target version');
const warnings = [];
const profiles = [
  { name: 'production', prefix: '' },
  { name: 'staging', prefix: 'test/' },
];
const state = [];

for (const { name, prefix } of profiles) {
  try {
    const build = readJson(prefix + 'build-info.json');
    const status = readJson(prefix + 'site-status.json');
    const index = readText(prefix + 'index.html');
    const bundle = readText(prefix + 'app.js');
    if (target && build.releaseVersion !== target) errors.push(name + ': release does not match target ' + target);
    if (target && status.maintenance) errors.push(name + ': maintenance remains enabled');
    if (build.projectRef && !bundle.includes('https://' + build.projectRef + '.supabase.co')) {
      errors.push(name + ': JavaScript does not reference its configured API project');
    }
    for (const asset of ['app.js', 'style.css']) {
      const digest = createHash('sha256').update(readFileSync(resolve(root, prefix + asset))).digest('hex').slice(0, 12);
      if (!index.includes('./' + asset + '?v=' + digest)) errors.push(name + ': stale asset hash for ' + asset);
    }
    const manifest = readJson(prefix + 'recognition-manifest.json');
    for (const file of manifest.files) {
      const bytes = readFileSync(resolve(root, prefix + file.name));
      if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
        errors.push(name + ': recognition integrity mismatch: ' + file.name);
      }
    }
    console.log(name + ': verified ' + manifest.files.length + ' recognition assets');
    state.push({ name, build, status });
    if (build.environment !== name) errors.push(name + ': incorrect build environment');
    if (status.environment !== name) errors.push(name + ': incorrect status environment');
    if (build.version !== status.version) errors.push(name + ': build/status hash mismatch');
    if (build.releaseVersion !== status.release?.version) {
      errors.push(name + ': build/status release version mismatch');
    }
    if (!/^[a-z0-9]{20}$/.test(build.projectRef ?? '')) {
      errors.push(name + ': invalid Supabase project ref');
    } else if (!index.includes('https://' + build.projectRef + '.supabase.co')) {
      errors.push(name + ': index CSP does not reference its own Supabase project');
    }
    if (!index.includes('./app.js?') || !index.includes('./style.css?')) {
      errors.push(name + ': required frontend assets not referenced');
    }
    if (typeof status.maintenance !== 'boolean') {
      errors.push(name + ': maintenance must be boolean');
    } else if (status.maintenance) {
      warnings.push(name + ': maintenance banner enabled');
    }
    console.log(name + ': frontend ' + build.releaseVersion +
      ', maintenance=' + status.maintenance + ', project=' + build.projectRef);
  } catch (error) {
    errors.push(name + ': cannot read or parse configuration (' + error.message + ')');
  }
}

if (state.length === 2) {
  const [production, staging] = state;
  if (production.build.projectRef === staging.build.projectRef) {
    errors.push('Production and staging share a Supabase project');
  }
  const versions = [production, staging].map(({ build }) =>
    (build.releaseVersion.match(/^\d+\.\d+\.\d+$/) ? build.releaseVersion.split('.').map(Number) : null));
  if (versions.every(Boolean) &&
      versions[1].some((v, i) => v !== versions[0][i]) &&
      versions[1].findIndex((v, i) => v !== versions[0][i]) >= 0) {
    const i = versions[1].findIndex((v, j) => v !== versions[0][j]);
    if (versions[1][i] > versions[0][i]) warnings.push('Staging is ahead of production: promotion may be unfinished');
  }
  if (production.status.maintenance && !staging.status.maintenance) {
    warnings.push('Production banner remains enabled while staging is active; check unfinished release');
  }
}

for (const warning of warnings) console.warn('WARNING: ' + warning);
for (const error of errors) console.error('ERROR: ' + error);
if (errors.length) process.exitCode = 1;
else console.log('CONFIG CHECK PASSED' + (warnings.length ? ' (with warnings)' : ''));
