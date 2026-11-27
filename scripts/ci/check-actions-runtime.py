#!/usr/bin/env python3
"""Check GitHub Actions runtime declarations, including transitive action calls."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from urllib.request import urlopen

import yaml


LOCK_PATH = '.github/actions-runtime-lock.json'
WORKFLOWS = '.github/workflows'
MANIFESTS = ('action.yml', 'action.yaml')
SEGMENT = re.compile(r'[A-Za-z0-9_.-]+')
FULL_SHA = re.compile(r'[a-f0-9]{40}')
DIGEST = re.compile(r'[a-f0-9]{64}')
RUNTIMES = {'node24', 'composite', 'docker'}


class PolicyError(Exception):
    pass


class ManifestLoader(yaml.BaseLoader):
    def construct_mapping(self, node, deep=False):
        result = {}
        for key, value in node.value:
            field = self.construct_object(key, deep=deep)
            if not isinstance(field, str) or field in result or field == '<<':
                raise PolicyError(f'invalid or duplicate YAML key at line {key.start_mark.line + 1}')
            result[field] = self.construct_object(value, deep=deep)
        return result


def parse(content, location):
    try:
        result = yaml.load(content, Loader=ManifestLoader)
    except (PolicyError, yaml.YAMLError) as error:
        raise PolicyError(f'{location}: {error}') from error
    if not isinstance(result, dict):
        raise PolicyError(f'{location}: expected a YAML mapping')
    return result


def safe_parts(path):
    parts = path.split('/')
    if any(part in {'.', '..'} or not SEGMENT.fullmatch(part) for part in parts):
        raise PolicyError(f'invalid metadata path {path!r}')
    return parts


def official_manifest(owner, repo, sha, path):
    url = f'https://raw.githubusercontent.com/{owner}/{repo}/{sha}/{path}'
    with urlopen(url, timeout=15) as response:
        content = response.read(1024 * 1024 + 1)
    if len(content) > 1024 * 1024:
        raise PolicyError('metadata exceeds 1 MiB')
    return content


class RuntimeAudit:
    def __init__(self, root, load_remote=official_manifest):
        self.root = root.resolve()
        self.lock = json.loads((self.root / LOCK_PATH).read_text())
        if not isinstance(self.lock, dict):
            raise PolicyError(f'{LOCK_PATH}: expected a mapping of immutable references')
        self.load_remote = load_remote
        self.active = set()
        self.checked = set()
        self.external = set()

    def run(self):
        directory = self.root / WORKFLOWS
        workflows = sorted(path for extension in ('*.yml', '*.yaml') for path in directory.glob(extension))
        if not workflows:
            raise PolicyError(f'{WORKFLOWS}: no workflows found')
        for path in workflows:
            self.local(path, workflow=True)
        for manifest in MANIFESTS:
            for path in sorted(self.root.rglob(manifest)):
                if not {'.git', 'node_modules', '.venv'}.intersection(path.relative_to(self.root).parts):
                    self.local(path, workflow=False)
        unused = sorted(set(self.lock) - self.external)
        if unused:
            raise PolicyError(f'{LOCK_PATH}: unused entries: {", ".join(unused)}')
        return len(workflows), len(self.external)

    def walk(self, content, location, workflow, remote):
        if location in self.active:
            raise PolicyError(f'{location}: circular Actions dependency')
        self.active.add(location)
        manifest = parse(content, location)
        if workflow:
            jobs = manifest.get('jobs')
            if not isinstance(jobs, dict):
                raise PolicyError(f'{location}: workflow jobs must be a mapping')
            for job_name, job in jobs.items():
                job_location = f'{location}, job {job_name}'
                if not isinstance(job, dict):
                    raise PolicyError(f'{job_location}: expected a mapping')
                if 'uses' in job:
                    self.reference(job['uses'], job_location, workflow=True, remote=remote)
                else:
                    self.steps(job.get('steps', []), job_location, remote)
        else:
            runs = manifest.get('runs', {})
            if not isinstance(runs, dict):
                raise PolicyError(f'{location}: runs must be a mapping')
            runtime = runs.get('using')
            if not isinstance(runtime, str) or runtime not in RUNTIMES:
                raise PolicyError(f'{location}: unsupported Actions runtime {runtime!r}; use native node24')
            if runtime == 'composite':
                self.steps(runs.get('steps'), location, remote)
        self.active.remove(location)
        self.checked.add(location)

    def steps(self, steps, location, remote):
        if not isinstance(steps, list):
            raise PolicyError(f'{location}: steps must be a YAML sequence')
        for number, step in enumerate(steps, 1):
            if not isinstance(step, dict):
                raise PolicyError(f'{location}, step {number}: expected a mapping')
            if 'uses' in step:
                self.reference(step['uses'], f'{location}, step {number}', workflow=False, remote=remote)

    def local(self, path, workflow):
        resolved = path.resolve()
        if resolved != path or not resolved.is_relative_to(self.root) or not resolved.is_file():
            raise PolicyError(f'{path}: expected a tracked-style repository file without symlinks')
        location = str(path.relative_to(self.root))
        if location not in self.checked:
            self.walk(path.read_bytes(), location, workflow, remote=False)

    def reference(self, reference, source, workflow, remote):
        if not isinstance(reference, str):
            raise PolicyError(f'{source}: uses must be a literal string')
        try:
            if reference.startswith('./'):
                if remote:
                    raise PolicyError('relative calls in external manifests require a reviewed immutable reference')
                parts = safe_parts(reference[2:])
                target = self.root.joinpath(*parts)
                if workflow:
                    if str(target.parent.relative_to(self.root)) != WORKFLOWS or target.suffix not in {'.yml', '.yaml'}:
                        raise PolicyError('local reusable workflow must be in .github/workflows')
                    self.local(target, workflow=True)
                else:
                    manifests = [target / name for name in MANIFESTS if (target / name).is_file()]
                    if len(manifests) != 1:
                        raise PolicyError('local action needs exactly one action.yml or action.yaml')
                    self.local(manifests[0], workflow=False)
                return
            self.remote(reference, workflow)
        except (PolicyError, OSError) as error:
            raise PolicyError(f'{source}: {reference}: {error}') from error

    def remote(self, reference, workflow):
        name, _, sha = reference.rpartition('@')
        if not FULL_SHA.fullmatch(sha):
            raise PolicyError('external Actions must be pinned to a 40-character commit SHA')
        parts = safe_parts(name)
        if len(parts) < 2:
            raise PolicyError('expected owner/repository[/path]@SHA')
        owner, repo, *subpath = parts
        if workflow and (subpath[:2] != ['.github', 'workflows'] or len(subpath) != 3 or
                         PurePosixPath(subpath[-1]).suffix not in {'.yml', '.yaml'}):
            raise PolicyError('expected an external reusable workflow in .github/workflows')
        entry = self.lock.get(reference)
        if not isinstance(entry, dict) or not DIGEST.fullmatch(str(entry.get('sha256', ''))):
            raise PolicyError(f'unknown action or invalid digest in {LOCK_PATH}; review official runtime metadata')
        allowed = [subpath] if workflow else [subpath + [manifest] for manifest in MANIFESTS]
        allowed = {'/'.join(parts) for parts in allowed}
        path = entry.get('path')
        if not isinstance(path, str) or path not in allowed:
            raise PolicyError(f'invalid metadata path in {LOCK_PATH}')
        self.external.add(reference)
        if reference in self.checked:
            return
        content = self.load_remote(owner, repo, sha, path)
        if hashlib.sha256(content).hexdigest() != entry['sha256']:
            raise PolicyError(f'official metadata digest mismatch for {path}')
        self.walk(content, reference, workflow, remote=True)


def self_test():
    # No network or workflow execution. Exercise a pin through reusable and composite calls.
    with TemporaryDirectory() as directory:
        root = Path(directory)
        (root / WORKFLOWS).mkdir(parents=True)
        (root / 'action').mkdir()
        workflow = root / WORKFLOWS / 'audit.yml'
        workflow.write_text('on: pull_request\njobs:\n  check:\n    uses: ./.github/workflows/reusable.yaml\n')
        (root / WORKFLOWS / 'reusable.yaml').write_text(
            'on: workflow_call\njobs:\n  check:\n    steps:\n      - uses: ./action\n')
        pin = 'a' * 40
        current = f'example/action@{pin}'
        composite = root / 'action/action.yml'

        def check(reference, runtime, expected=None):
            metadata = f'runs:\n  using: {runtime}\n'.encode()
            composite.write_text(f'runs:\n  using: composite\n  steps:\n    - uses: {reference}\n')
            (root / LOCK_PATH).write_text(json.dumps({current: {
                'path': 'action.yml', 'sha256': hashlib.sha256(metadata).hexdigest(),
            }}))
            try:
                RuntimeAudit(root, load_remote=lambda *args: metadata).run()
            except PolicyError as error:
                if expected is None or expected not in str(error) or 'action/action.yml, step 1' not in str(error):
                    raise
            else:
                if expected is not None:
                    raise PolicyError(f'self-test did not reject {reference} ({runtime})')

        check(current, 'node24')
        check(current, 'node20', 'unsupported Actions runtime')
        check('example/action@v4', 'node24', '40-character commit SHA')
        check(f'example/action@{"b" * 40}', 'node24', 'unknown action')
    print('Actions runtime policy self-test passed (4 cases)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
        else:
            workflows, actions = RuntimeAudit(Path(__file__).resolve().parents[2]).run()
            print(f'Actions runtime policy passed for {workflows} workflows and {actions} external SHA pins')
    except (PolicyError, OSError, ValueError) as error:
        print(f'Actions runtime policy failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
