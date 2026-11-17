#!/usr/bin/env python3
"""Single source of truth: site-status.json -> both release manifests, histories and HTML cache keys."""
import json
import re
import sys
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
owner = json.loads((ROOT/'release-status.json').read_text(encoding='utf-8')).get('ownerVersion', '')
if not re.fullmatch(r'OW-\d{2}\.\d{2}\.\d{2} v', owner):
    raise SystemExit('Invalid OW version in release-status.json')

def write(path, value):
    contents = json.dumps(value, ensure_ascii=False, indent=2)+'\n'
    if not path.exists() or path.read_text(encoding='utf-8') != contents:
        path.write_text(contents, encoding='utf-8')
        print('SYNC:',path.relative_to(ROOT))

manifest = {'version':version,'ownerVersion':owner,'status':'released',
            'date':active['date'],'changes':active['changes']}
for path in [ROOT/'release-status.json', ROOT/'test/release-status.json']:
    write(path,manifest)

staging = ROOT/'test/site-status.json'
test_data=json.loads(staging.read_text(encoding='utf-8'))
test_data['release']=active
test_data['releases']=[active]+[x for x in test_data['releases'] if x['version']!=version]
write(staging,test_data)

for page in [ROOT/'index.html',ROOT/'test/index.html']:
    contents=page.read_text(encoding='utf-8')
    pat=r'(portal-release-status-20261117\.js\?v=)[^"]+'
    replacement=r'\g<1>'+quote(version,safe='')+'&rev=unified'
    updated,count=re.subn(pat,lambda _: 'portal-release-status-20261117.js?v='+quote(version,safe='')+'&rev=unified',contents)
    if count!=1:
        raise SystemExit('Missing or repeated release script in '+str(page))
    if updated!=contents:
        page.write_text(updated,encoding='utf-8')
        print('SYNC:',page.relative_to(ROOT))
print('Validated single release',version,'owner',owner)
