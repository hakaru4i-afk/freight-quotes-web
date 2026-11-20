#!/usr/bin/env python3
"""Synchronize display metadata without rewriting approved production assets."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'site-status.json').read_text(encoding='utf-8'))
active = source['release']
version = active['version']
if not re.fullmatch(r'SH-\d{2}\.\d{2}\.\d{2} v', version):
    raise SystemExit('Invalid SH version in site-status.json')
if not active.get('title') or not active.get('changes'):
    raise SystemExit('Release title and changes are mandatory')
if source['releases'][0]['version'] != version:
    raise SystemExit('Put the new release at the start of site-status.json releases')
approved = json.loads((ROOT / 'production-release-manifest.json').read_text(encoding='utf-8'))
production_info = json.loads((ROOT / 'build-info.json').read_text(encoding='utf-8'))
if (approved.get('businessVersion') != version
        or production_info.get('releaseVersion') != version
        or production_info.get('build') != approved.get('frontendBuild')):
    raise SystemExit('PRODUCTION_PUBLICATION_PROVENANCE_MISMATCH: use the approved production release packet')
approved_assets = approved['assets']
pending = {}

owner = json.loads((ROOT/'release-status.json').read_text(encoding='utf-8')).get('ownerVersion', '')
if not re.fullmatch(r'OW-\d{2}\.\d{2}\.\d{2} v', owner):
    raise SystemExit('Invalid OW version in release-status.json')

def write(path, value):
    contents = json.dumps(value, ensure_ascii=False, indent=2)+'\n'
    pending[path] = contents

state=source.get('releaseStatus','checking')
if state not in ('updating','checking','released','failed'):
    raise SystemExit('Invalid release status')
# A build explicitly marked PUBLISHED for this release must not be shown as still checking.
if (production_info.get('releaseStatus') == 'PUBLISHED'
        and production_info.get('releaseVersion') == version
        and state in ('updating','checking')):
    state='released'
    source['releaseStatus']=state
    write(ROOT/'site-status.json',source)
manifest = {'version':version,'ownerVersion':owner,'status':state,
            'date':active['date'],'changes':active['changes']}
for path in [ROOT/'release-status.json', ROOT/'test/release-status.json']:
    write(path,manifest)

staging = ROOT/'test/site-status.json'
test_data=json.loads(staging.read_text(encoding='utf-8'))
test_data['release']=active
test_data['releaseStatus']=state
test_data['releases']=[active]+[x for x in test_data['releases'] if x['version']!=version]
write(staging,test_data)

for build_path in [ROOT/'build-info.json', ROOT/'test/build-info.json']:
    info=json.loads(build_path.read_text(encoding='utf-8'))
    info['releaseVersion']=version
    info['ownerReleaseVersion']=owner
    write(build_path,info)

for page in [ROOT/'index.html',ROOT/'test/index.html']:
    contents=page.read_text(encoding='utf-8')
    pat=r'(portal-release-status-20261117\.js\?v=)[^"]+'
    updated,count=re.subn(pat,lambda _: 'portal-release-status-20261117.js?v='+quote(version,safe='')+'&rev=unified',contents)
    if count!=1:
        raise SystemExit('Missing or repeated release script in '+str(page))
    pending[page] = updated

# Complete all validation before modifying either environment's files.
for name, digest in approved_assets.items():
    path = ROOT / name
    if not path.resolve().is_relative_to(ROOT) or path.is_symlink():
        raise SystemExit('Invalid approved asset path: ' + name)
    current = path.read_bytes()
    proposed = pending[path].encode('utf-8') if path in pending else current
    if any(hashlib.sha256(data).hexdigest() != digest for data in (current, proposed)):
        raise SystemExit('PRODUCTION_PUBLICATION_PROVENANCE_MISMATCH: approved asset ' + name)
for path, contents in pending.items():
    encoded = contents.encode('utf-8')
    if not path.exists() or path.read_bytes() != encoded:
        path.write_bytes(encoded)
        print('SYNC:', path.relative_to(ROOT))
print('Validated single release', version, 'owner', owner)
