import {createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';

const gitSha = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;
const migration = /^\d{14}$/;
const requestId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

export function expectedReleasePair(manifest) {
  const qa = manifest?.sh59IsolatedQa;
  const backendSha = qa ? qa.sourceCommit : manifest?.apiSourceCommit;
  const backendVersion = qa ? qa.version : manifest?.apiVersion;
  const backendBundle = qa ? qa.providerBundleSha256 : manifest?.apiBundleSha256;
  const sqlMigrationVersion = qa?.catalogMigrationVersion || manifest?.sqlMigrationVersion;
  if (!gitSha.test(manifest?.frontendCommit || '') || !gitSha.test(backendSha || '') ||
      !sha256.test(backendBundle || '') || !Number.isInteger(backendVersion) || backendVersion < 1 ||
      !migration.test(sqlMigrationVersion || '') ||
      (qa?.catalogMigrationVersion && qa.observedStagingLedger !== sqlMigrationVersion) ||
      (qa && qa.sourceCommit !== manifest.backendSourceCommit)) return null;
  return {
    frontendSource: manifest.frontendCommit,
    backendSha,
    backendVersion,
    backendBundle,
    sqlMigrationVersion
  };
}

export function exactAcceptanceRoster(ids, rows) {
  return Array.isArray(rows) && rows.length === ids.length &&
    new Set(rows.map(row => row?.id)).size === ids.length &&
    rows.every(row => ids.includes(row?.id));
}

function safeArtifactPath(path) {
  return typeof path === 'string' && /^[A-Za-z0-9_./-]+$/.test(path) &&
    !path.split('/').some(part => !part || part === '..' || part === '.');
}

export function loadAcceptanceEvidence(root, pair, {frontendSha, runId}) {
  const cache = new Map();
  return function verify(row) {
    const {sources, traceId} = row.evidence;
    let browserVerified = false;
    const screenshots = new Map(sources.filter(s => s.file.endsWith('.png')).map(s => [s.file,s.sha256]));
    try {
      const artifact = realpathSync(root);
      for (const source of sources) {
        if (!cache.has(source.file)) {
          const path = realpathSync(resolve(artifact, source.file));
          if (!path.startsWith(artifact + sep)) return false;
          const bytes = readFileSync(path);
          cache.set(source.file, {digest: createHash('sha256').update(bytes).digest('hex'),
            json: source.file.endsWith('.json') ? JSON.parse(bytes) : null,
            screenshot: bytes.subarray(0,pngSignature.length).equals(pngSignature)});
        }
        const file = cache.get(source.file);
        if (file.digest !== source.sha256 || (source.file.endsWith('.png') && !file.screenshot)) return false;
        const report = file.json;
        if (!/(^|\/)browser-results-[^/]+\.json$/.test(source.file) || !report) continue;
        if (report.frontendSha !== frontendSha || report.frontendSource !== pair.frontendSource ||
            report.backendSourceCommit !== pair.backendSha || report.backendVersion !== pair.backendVersion ||
            report.backendBundle !== pair.backendBundle || report.sqlMigrationVersion !== pair.sqlMigrationVersion ||
            report.workflowRunId !== runId || report.mocks !== false || report.immutableSource !== true ||
            report.sourceTreeDirty !== false || report.transport !== 'TLS_VERIFIED_REAL_HTTP') return false;
        const trace = report.calls?.some(call => call.requestId === traceId &&
          call.status === 200 && call.path?.startsWith('/api/'));
        const image = report.roles?.some(role => role.status === 'PASS' && role.viewports?.some(view => {
          const entry = view.screenshot?.replace(/^reports\//, '');
          return screenshots.has(entry) && screenshots.get(entry) === view.screenshotSha256;
        }));
        browserVerified ||= trace && image;
      }
    } catch {
      return false;
    }
    return browserVerified;
  };
}

export function isAuthenticatedCase(row, verifySources) {
  const evidence = row?.evidence;
  const sources = evidence?.sources;
  return row?.status === 'PASS' && row.mode === 'AUTHENTICATED_QA_API' &&
    typeof row.actorRole === 'string' && row.actorRole.trim().length > 0 &&
    evidence?.method === 'HTTP_AND_BROWSER' && evidence.responseVerified === true &&
    requestId.test(evidence.traceId || '') &&
    Array.isArray(sources) && sources.length > 0 &&
    new Set(sources.map(source => source?.file)).size === sources.length &&
    sources.every(source => safeArtifactPath(source?.file) && sha256.test(source.sha256 || '')) &&
    verifySources(row);
}

export function matchesAcceptancePair(evidence, pair, {frontendSha, runId}) {
  return !!pair && gitSha.test(frontendSha || '') && /^[1-9][0-9]*$/.test(runId || '') &&
    evidence?.environment === 'isolated-qa' && evidence.authorized === true &&
    evidence.runId === runId && evidence.frontendSha === frontendSha &&
    Object.entries(pair).every(([key, value]) => evidence[key] === value);
}

export function matchesPublishedPair(evidence, manifest, pair, frontendSha) {
  return !!pair && manifest.publicationState !== 'CANDIDATE_NOT_RELEASED' &&
    evidence?.result === 'PASS' && evidence.environment === 'staging' &&
    evidence.frontendSha === frontendSha && evidence.frontendSource === pair.frontendSource &&
    evidence.backendSha === pair.backendSha && manifest.apiSourceCommit === pair.backendSha &&
    evidence.backendVersion === manifest.apiVersion &&
    sha256.test(manifest.apiBundleSha256 || '') && evidence.backendBundle === manifest.apiBundleSha256 &&
    evidence.sqlMigrationVersion === pair.sqlMigrationVersion &&
    evidence.backendMatchesCandidate === true && evidence.servedAssetsExact === true;
}
