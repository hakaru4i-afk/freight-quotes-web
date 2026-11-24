import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const source = readFileSync('test/feedback-recovery.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture({owner = true, allowed = true} = {}) {
  const calls = [];
  const listeners = {};
  const detail = {
    querySelector: () => null,
    insertBefore: form => { form.parentNode = detail; detail.form = form; },
  };
  const selected = {dataset: {pfId: 'request-id'}, querySelector: () => null};
  const refresh = {click: () => { refresh.clicked = true; }};
  const root = {prepend: notice => { root.notice = notice; }, querySelector: selector => ({
    '.pf-metrics': owner ? {} : null,
    '.pf-list .pf-selected': selected,
    '.pf-detail': detail,
    '[data-pf="refresh"]': refresh,
    '.pf-recovery-confirmation': root.notice
  })[selector]};
  let revision = '1';
  let result = {ok: false, error: 'RECOVERY_STALE'};
  runInNewContext(source, {
    document: {
      documentElement: {lang: 'en'},
      getElementById: () => root,
      addEventListener: (event, handler) => { listeners[event] = handler; },
      createTextNode: text => text,
      createElement: () => ({
        children: [], events: {},
        append(...children) { this.children.push(...children); },
        addEventListener(event, handler) { this.events[event] = handler; },
        setAttribute() {},
        remove() { if (detail.form === this) delete detail.form; }
      })
    },
    Option: class {},
    MutationObserver: class { observe() {} },
    fetch: async (url, options) => {
      calls.push({url, body: options.body && JSON.parse(options.body)});
      const body = options.method === 'POST'
        ? result : {ok: allowed, revision, options: {next: 'in_progress'}};
      return {ok: body.ok, json: async () => body};
    }
  });
  await tick();

  return {
    calls, detail, refresh, root,
    async reload(nextRevision) {
      revision = nextRevision;
      listeners.click({target: {closest: () => refresh}});
      await tick();
    },
    allowWrite() { result = {ok: true}; }
  };
}

test('staging connects recovery to the Improvement center', () => {
  const html = readFileSync('test/index.html', 'utf8');
  assert.match(html, /portal-feedback-center-20261107\.js[^<]*<\/script><script src="\.\/feedback-recovery\.js\?v=[\da-f]{12}" defer>/);
});

test('only displays actions after a successful server capability check', async () => {
  const author = await fixture({owner: false});
  assert.equal(author.calls.length, 0);
  assert.equal(author.detail.form, undefined);
  const denied = await fixture({allowed: false});
  assert.equal(denied.calls.length, 1);
  assert.equal(denied.detail.form, undefined);
});

test('requires confirmation and a fresh revision after conflict', async () => {
  const {calls, detail, reload, refresh, root, allowWrite} = await fixture();
  function fill() {
    const form = detail.form;
    const fields = form.children[1];
    const [[operation], [reason], [check]] = fields.children.map(child => child.children);
    operation.value = 'next';
    reason.value = 'Resolve a stalled review';
    return {form, fields, check, reason, save: () => form.events.submit({preventDefault() {}})};
  }
  let {form, fields, check, reason, save} = fill();
  check.checked = true;
  form.events.input({target: reason});
  await save();
  assert.equal(calls.length, 1);
  check.checked = true;
  await save();
  assert.equal(fields.disabled, true);
  assert.match(form.children[2].textContent, /Refresh the list/);
  await save();
  assert.equal(calls.length, 2);
  await reload('2');
  allowWrite();
  ({fields, check, save} = fill());
  check.checked = true;
  await save();
  assert.equal(calls.at(-1).body.revision, '2');
  assert.equal(calls.at(-1).body.operation, 'next');
  assert.equal(fields.disabled, true);
  assert.equal(refresh.clicked, true);
  assert.match(root.notice.textContent, /recorded in history/);
});
