// Carrier124 fixtures are issued and closed only through the protected GitHub OIDC broker.
import {
  appendFileSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const actors = {
  owner: 'OWNER', carrierA: 'CARRIER_A', carrierB: 'CARRIER_B', ved: 'VED',
  logistic: 'LOGISTIC', supplier: 'SUPPLIER', supplierB: 'SUPPLIER_B',
  designer: 'DESIGNER', content: 'CONTENT', purchasing: 'PURCHASING', certification: 'CERTIFICATION',
};

const endpoint = 'https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-qa-credential-broker-carrier124';
const transientStatus = new Set([408, 429, 500, 502, 503, 504]);
const delays = [1000, 3000, 7000];

function failure(code, retryable = false, retryAfter = undefined) {
  return Object.assign(new Error(code), { retryable, retryAfter });
}

function delayFor(error, attempt) {
  const retryAfter = error.retryAfter;
  if (!retryAfter) return delays[attempt];
  const milliseconds = /^\d+$/.test(retryAfter)
    ? Number(retryAfter) * 1000
    : Date.parse(retryAfter) - Date.now();
  return Number.isFinite(milliseconds)
    ? Math.min(10000, Math.max(delays[attempt], milliseconds))
    : delays[attempt];
}

async function withRetry(operation, wait) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!error.retryable || attempt >= delays.length) throw error;
      await wait(delayFor(error, attempt));
    }
  }
}

async function responseJson(fetcher, url, options, label) {
  let response;
  try {
    response = await fetcher(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw failure(label + '_TRANSPORT', true);
  }
  let body;
  try {
    body = await response.text();
  } catch {
    throw failure(label + '_RESPONSE_TRANSPORT', true);
  }
  if (!response.ok) {
    throw failure(
      label + '_HTTP_' + response.status,
      transientStatus.has(response.status),
      response.headers.get('Retry-After'),
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw failure(label + '_INVALID_RESPONSE');
  }
}

export function createBrokerClient({ identityUrl, requestToken, fetcher = fetch, wait = sleep }) {
  const url = new URL(identityUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('HTTPS_IDENTITY_REQUIRED');
  url.searchParams.set('audience', 'freight-isolated-qa-credentials');

  async function freshIdentity() {
    return withRetry(async () => {
      const data = await responseJson(fetcher, url, {
        headers: { Authorization: 'Bearer ' + requestToken },
      }, 'GITHUB_IDENTITY');
      if (typeof data?.value !== 'string' || !data.value) throw failure('GITHUB_IDENTITY_EMPTY');
      return data.value;
    }, wait);
  }

  return async (action, actor) => withRetry(async () => {
    // Never replay a short-lived identity after a broker transport failure.
    const identity = await freshIdentity().catch(error => {
      // Identity retries already occurred. Do not multiply two retry budgets.
      throw failure(error.message);
    });
    const data = await responseJson(fetcher, endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + identity, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actor }),
    }, 'QA_BROKER');
    if (data?.ok !== true) throw failure('QA_BROKER_RESPONSE_INVALID');
    return data;
  }, wait);
}

export function openJournal(directory, run) {
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const dir = lstatSync(directory);
  if (!dir.isDirectory() || (dir.mode & 0o077) !== 0) throw Error('QA_OIDC_STATE_DIRECTORY_UNSAFE');

  const path = join(directory, 'actors.json');
  let state = { ...run, pending: [], closed: [] };
  try {
    const file = lstatSync(path);
    if (!file.isFile() || (file.mode & 0o077) !== 0) throw Error('QA_OIDC_STATE_FILE_UNSAFE');
    state = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (Object.keys(run).some(key => state[key] !== run[key]) ||
      !Array.isArray(state.pending) || !Array.isArray(state.closed)) {
    throw Error('QA_OIDC_STATE_MISMATCH');
  }
  const tracked = [...state.pending, ...state.closed];
  if (tracked.some(actor => !Object.hasOwn(actors, actor)) ||
      tracked.length !== new Set(tracked).size) throw Error('QA_OIDC_STATE_ACTORS_INVALID');

  return {
    state,
    save() {
      const temporary = join(directory, 'actors-' + randomUUID() + '.tmp');
      try {
        writeFileSync(temporary, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
        renameSync(temporary, path);
      } finally {
        rmSync(temporary, { force: true });
      }
    },
  };
}

export async function issueActors(journal, broker, exportCredential, log = console.log) {
  const { state } = journal;
  if (state.pending.length || state.closed.length) throw Error('QA_OIDC_ISSUANCE_ALREADY_STARTED');
  for (const [actor, prefix] of Object.entries(actors)) {
    // Record the intent before sending: a timeout can follow a committed issue.
    state.pending.push(actor);
    journal.save();
    const data = await broker('issue', actor);
    if (!/^[a-f0-9]{64}$/.test(data.password ?? '') ||
        data.login !== 'carrier124nov18-' + actor.toLowerCase() || data.prefix !== prefix) {
      throw Error('QA_BROKER_CREDENTIAL_RESPONSE_INVALID');
    }
    exportCredential(prefix, data);
    log('QA_OIDC_FIXTURE_READY', actor);
  }
}

export async function finishActors(journal, broker, log = console.log) {
  const { state } = journal;
  for (const actor of [...state.pending]) {
    try {
      const data = await broker('finish', actor);
      if (data.ok !== true || data.closed !== true) throw Error('QA_BROKER_CLOSE_NOT_CONFIRMED');
    } catch (error) {
      log('QA_OIDC_FIXTURE_PENDING', actor, safeError(error));
      continue;
    }
    state.pending = state.pending.filter(pending => pending !== actor);
    state.closed.push(actor);
    journal.save();
    log('QA_OIDC_FIXTURE_CLOSED', actor);
  }
  return state.pending.length === 0;
}

function safeError(error) {
  return /^[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'QA_OIDC_UNEXPECTED_ERROR';
}

function jobContext(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== 'hakaru4i-afk/freight-quotes-web' ||
      env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      env.RUNNER_ENVIRONMENT !== 'github-hosted') throw Error('PROTECTED_MAIN_JOB_REQUIRED');

  const runId = env.GITHUB_RUN_ID ?? '';
  const runAttempt = env.GITHUB_RUN_ATTEMPT ?? '';
  const workflowSha = env.GITHUB_SHA ?? '';
  if (!/^\d{1,18}$/.test(runId) || !/^\d{1,5}$/.test(runAttempt) ||
      !/^[a-f0-9]{40}$/.test(workflowSha) || !env.RUNNER_TEMP) throw Error('INVALID_QA_RUN_CONTEXT');
  return { runId, runAttempt, workflowSha };
}

async function main(finish, env) {
  const run = jobContext(env);
  const directory = join(env.RUNNER_TEMP, 'carrier124-oidc-' + run.runId + '-' + run.runAttempt);
  const journal = openJournal(directory, run);
  const { state } = journal;
  if (!finish || state.pending.length) {
    if (!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || !env.ACTIONS_ID_TOKEN_REQUEST_URL) {
      throw Error('GITHUB_OIDC_PERMISSION_REQUIRED');
    }
    const broker = createBrokerClient({
      identityUrl: env.ACTIONS_ID_TOKEN_REQUEST_URL,
      requestToken: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    });
    if (!finish) {
      if (!env.GITHUB_ENV) throw Error('GITHUB_ENV_REQUIRED');
      await issueActors(journal, broker, (prefix, data) => {
        console.log('::add-mask::' + data.password);
        appendFileSync(env.GITHUB_ENV,
          'QA_' + prefix + '_LOGIN=' + data.login + '\nQA_' + prefix + '_PASSWORD=' + data.password + '\n');
      });
      return;
    }
    await finishActors(journal, broker);
  }

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/carrier124-ci-cleanup.json',
    JSON.stringify({ ...state, ok: state.pending.length === 0 }, null, 2) + '\n', { mode: 0o600 });
  if (state.pending.length) throw Error('QA_OIDC_CLEANUP_INCOMPLETE');
  console.log('QA_OIDC_CLEANUP_CONFIRMED', state.closed.length);
}

if (import.meta.main) {
  try {
    await main(process.argv.includes('--finish'), process.env);
  } catch (error) {
    console.log('QA_OIDC_BLOCKED', safeError(error));
    process.exitCode = 1;
  }
}
