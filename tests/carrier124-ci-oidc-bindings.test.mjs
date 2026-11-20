import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { actors, createBrokerClient, finishActors, issueActors, openJournal } from './carrier124-ci-oidc-bindings.mjs';

const identityUrl = 'https://identity.invalid/request';
const run = { runId: '123', runAttempt: '1', workflowSha: 'a'.repeat(40) };
const quiet = () => {};

function temporaryJournal(t) {
  const base = mkdtempSync(join(tmpdir(), 'carrier124-journal-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const path = join(base, 'private');
  return { path, journal: openJournal(path, run) };
}

test('bounded transient retries obtain a fresh OIDC identity after a lost close response', async () => {
  const waits = [];
  const identities = [];
  let identityAttempts = 0;
  const broker = createBrokerClient({
    identityUrl, requestToken: 'unit-test-only',
    wait: async ms => { waits.push(ms); },
    fetcher: async (input, options) => {
      const url = new URL(input);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      if (url.origin === 'https://identity.invalid') {
        assert.equal(url.searchParams.get('audience'), 'freight-isolated-qa-credentials');
        identityAttempts++;
        if (identityAttempts === 1) return new Response('', { status: 429, headers: { 'Retry-After': '2' } });
        if (identityAttempts === 2) throw new TypeError('synthetic timeout');
        return Response.json({ value: 'identity-' + identityAttempts });
      }
      identities.push(options.headers.Authorization);
      assert.deepEqual(JSON.parse(options.body), { action: 'finish', actor: 'owner' });
      if (identities.length === 1) return new Response('', { status: 503 });
      return Response.json({ ok: true, closed: true });
    },
  });
  assert.deepEqual(await broker('finish', 'owner'), { ok: true, closed: true });
  assert.deepEqual(identities, ['Bearer identity-3', 'Bearer identity-4']);
  assert.deepEqual(waits, [2000, 3000, 1000]);
});

test('persistent throttling is bounded and permanent authorization failure is never retried', async () => {
  for (const status of [429, 403]) {
    let requests = 0;
    const broker = createBrokerClient({
      identityUrl, requestToken: 'unit-test-only', wait: async () => {},
      fetcher: async () => { requests++; return new Response('', { status }); },
    });
    await assert.rejects(() => broker('finish', 'owner'), new RegExp('GITHUB_IDENTITY_HTTP_' + status));
    assert.equal(requests, status === 429 ? 4 : 1);
  }
});

test('finish continues across all 11 actors and a fresh invocation resumes only unconfirmed closures', async t => {
  const { path, journal } = temporaryJournal(t);
  const keys = Object.keys(actors);
  journal.state.pending.push(...keys);
  journal.save();
  const first = [];
  const ok = await finishActors(journal, async (action, actor) => {
    assert.equal(action, 'finish');
    first.push(actor);
    if (actor === 'carrierA') throw Error('GITHUB_IDENTITY_HTTP_429');
    if (actor === 'purchasing') return { ok: true }; // A successful HTTP status is insufficient.
    return { ok: true, closed: true };
  }, quiet);
  assert.equal(ok, false);
  assert.deepEqual(first, keys);
  assert.equal(statSync(path).mode & 0o777, 0o700);
  assert.equal(statSync(join(path, 'actors.json')).mode & 0o777, 0o600);
  const resumed = openJournal(path, run);
  assert.deepEqual(resumed.state.pending, ['carrierA', 'purchasing']);
  const second = [];
  assert.equal(await finishActors(resumed, async (_, actor) => {
    second.push(actor);
    return { ok: true, closed: true };
  }, quiet), true);
  assert.deepEqual(second, ['carrierA', 'purchasing']);
  assert.deepEqual(openJournal(path, run).state.closed.toSorted(), keys.toSorted());
  assert.throws(() => openJournal(path, { ...run, runAttempt: '2' }), /QA_OIDC_STATE_MISMATCH/);
});

test('an issue request that loses its reply is journaled before the operation with no secret on disk', async t => {
  const { path, journal } = temporaryJournal(t);
  await assert.rejects(issueActors(journal, async (action, actor) => {
    assert.equal(action, 'issue');
    assert.equal(actor, 'owner');
    assert.deepEqual(openJournal(path, run).state.pending, ['owner']);
    throw Error('QA_BROKER_RESPONSE_TRANSPORT');
  }, () => assert.fail('Unexpected credentials'), quiet), /QA_BROKER_RESPONSE_TRANSPORT/);
  const state = JSON.parse(readFileSync(join(path, 'actors.json'), 'utf8'));
  assert.deepEqual(state, { ...run, pending: ['owner'], closed: [] });
  assert.equal(await finishActors(openJournal(path, run), async () => ({ ok: true, closed: true }), quiet), true);
});
