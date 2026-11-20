#!/usr/bin/env python3
"""Plan release metadata per environment; never approve or publish a release."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]

def plan(root):
    pending = {}
    def load(name):
        return json.loads((root / name).read_text(encoding='utf-8'))
    def put(name, value):
        pending[name] = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    for prefix, environment, project in [('', 'production', 'ooclsrndeygojtofuyte'), ('test/', 'staging', 'ibclzdkxiozbzmniiygv')]:
        status = load(prefix + 'site-status.json')
        active = status['release']
        version = active['version']
        if not re.fullmatch(r'SH-\d{2}\.\d{2}\.\d{2} v', version):
            raise ValueError('INVALID_BUSINESS_VERSION:' + environment)
        if not active.get('title') or not active.get('changes') or status['releases'][0]['version'] != version:
            raise ValueError('STALE_RELEASE_NOTES:' + environment)
        state = status.get('releaseStatus', 'checking')
        if state not in ('updating', 'checking', 'released', 'failed'):
            raise ValueError('INVALID_PUBLICATION_STATE:' + environment)
        owner = load(prefix + 'release-status.json').get('ownerVersion', '')
        if not re.fullmatch(r'OW-\d{2}\.\d{2}\.\d{2} v', owner):
            raise ValueError('INVALID_OWNER_VERSION:' + environment)
        info = load(prefix + 'build-info.json')
        if info.get('environment') != environment or info.get('projectRef') != project:
            raise ValueError('UNSAFE_ENVIRONMENT_IDENTITY:' + environment)
        if info.get('primaryBusinessVersion', version) != version:
            raise ValueError('UNREVIEWED_PRIMARY_BUSINESS_VERSION:' + environment)
        if environment == 'production':
            manifest = load('production-release-manifest.json')
            if manifest.get('businessVersion') != version or manifest.get('frontendBuild') != info.get('build'):
                raise ValueError('PUBLISHED_MANIFEST_MISMATCH:production')
        put(prefix + 'release-status.json', {'version': version, 'ownerVersion': owner,
            'status': state, 'date': active['date'], 'changes': active['changes']})
        # PUBLISHED is a publication fact, never an automatic QA/Owner approval.
        # Preserve both environments' own notes, state, and historical build pins.
        info['releaseVersion'] = version
        info['ownerReleaseVersion'] = owner
        put(prefix + 'build-info.json', info)
        name = prefix + 'index.html'
        contents = (root / name).read_text(encoding='utf-8')
        updated, count = re.subn(r'(portal-release-status-20261117\.js\?v=)[^"]+',
            lambda _: 'portal-release-status-20261117.js?v=' + quote(version, safe='') + '&rev=unified', contents)
        if count != 1:
            raise ValueError('MISSING_OR_REPEATED_RELEASE_SCRIPT:' + environment)
        pending[name] = updated
    changes = {name: text for name, text in pending.items()
               if (root / name).read_text(encoding='utf-8') != text}
    # An approved asset cannot be re-stamped independently of its release packet.
    approved_assets = load('production-release-manifest.json').get('assets', {})
    for name, text in changes.items():
        if name in approved_assets and hashlib.sha256(text.encode('utf-8')).hexdigest() != approved_assets[name]:
            raise ValueError('IMMUTABLE_PRODUCTION_ASSET_REQUIRES_RELEASE:' + name)
    return changes

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='Read only; default')
    mode.add_argument('--write', action='store_true', help='Apply the fully validated plan locally; never deploy')
    args = parser.parse_args()
    try:
        changes = plan(ROOT)
    except (ValueError, KeyError, OSError) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error), 'written': []}))
        return 1
    if not args.write:
        print(json.dumps({'status': 'STALE' if changes else 'CURRENT', 'changes': list(changes), 'written': []}))
        return int(bool(changes))
    # Validate *all* inputs before the first write, including the second HTML page.
    for name, text in changes.items():
        (ROOT / name).write_text(text, encoding='utf-8')
    print(json.dumps({'status': 'SYNCHRONIZED', 'written': list(changes)}))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
