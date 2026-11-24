import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {readJson, runReceipt} from './locked-evidence-run.mjs';
import {
  digest,
  qaFunction,
  qaProject,
  readLock,
  requireFreshTime,
  sha64,
  stagingUrl,
} from './locked-release.mjs';

export function compileE2e(lock, runtime, after, reports, run, startedAt, now = Date.now()) {
  const {observedAt: beforeTime, ...beforeIdentity} = runtime;
  const {observedAt: afterTime, ...afterIdentity} = after;
  assert.deepEqual(afterIdentity, beforeIdentity, 'STAGING_RUNTIME_CHANGED_DURING_E2E');
  requireFreshTime(afterTime, Date.parse(beforeTime), now);
  assert.equal(runtime.frontendSha, lock.frontendSha);
  assert.equal(runtime.backendSha, lock.backendSha);
  assert.equal(runtime.sourceCommit, lock.backendSha);
  assert.equal(runtime.function, qaFunction);
  assert.equal(runtime.stagingUrl, stagingUrl);
  assert.match(runtime.bundle, sha64);
  assert.match(runtime.qaEntrySha256, sha64);
  assert.ok(Number.isSafeInteger(runtime.version) && runtime.version > 0);
  assert.deepEqual(Object.keys(runtime.servedHashes).sort(), ['app.js', 'index.html', 'style.css']);
  for (const hash of Object.values(runtime.servedHashes)) assert.match(hash, sha64);

  const hash = sha64;
  const seen = new Map();
  let refs = [];
  function take(file) {
    if (!seen.has(file)) {
      const bytes = readFileSync(join(reports, file));
      const evidence = JSON.parse(bytes);
      assert.equal(evidence.runId, run.runId, 'WRONG_RECEIPT_RUN:' + file);
      assert.equal(evidence.runAttempt, run.attempt, 'WRONG_RECEIPT_ATTEMPT:' + file);
      requireFreshTime(evidence.startedAt, startedAt, now);
      requireFreshTime(evidence.completedAt ?? evidence.finishedAt, Date.parse(evidence.startedAt), now);
      seen.set(file, {file, sha256: digest(bytes), evidence});
    }
    const entry = seen.get(file);
    refs.push({file, sha256: entry.sha256});
    return entry.evidence;
  }

  function browser(file, actor) {
    const evidence = take(file);
    assert.equal(evidence.frontendSha, lock.frontendSha);
    assert.equal(evidence.backendSourceCommit, lock.backendSha);
    assert.equal(evidence.backendFunction, runtime.function);
    assert.equal(evidence.backendVersion, runtime.version);
    assert.equal(evidence.backendBundle, runtime.bundle);
    assert.equal(evidence.sourceSite, stagingUrl);
    assert.equal(evidence.transport, 'TLS_VERIFIED_REAL_HTTP');
    assert.equal(evidence.mocks, false);
    assert.equal(evidence.immutableSource, true);
    assert.equal(evidence.sourceTreeDirty, false);
    for (const [name, hash] of Object.entries(runtime.servedHashes)) {
      assert.equal(evidence.servedAssetHashes[name], hash, 'BROWSER_STAGING_ASSET_MISMATCH:' + name);
    }
    const role = evidence.roles.find((role) => role.actor === actor);
    assert.equal(role?.status, 'PASS');
    assert.ok(
      evidence.calls.some(
        (call) => call.actor === actor && call.path.startsWith('/api/') && call.status === 200,
      ),
      'MISSING_VERIFIED_BROWSER_HTTP:' + file + ':' + actor,
    );
    return role;
  }

  const main = (actor, phase) =>
    browser('isolated-rc/browser-results-' + actor + '-' + phase + '.json', actor);
  const create = () => main('owner', 'create');
  const selection = () => main('owner', 'select');
  const winner = (prefix) => {
    const result = browser(prefix + '/browser-results-owner-select.json', 'owner');
    assert.ok(['carrierA', 'carrierB'].includes(result.selection.winnerActor));
    return result.selection.winnerActor;
  };
  const rail = (actor, phase, prefix = 'nov14-published') =>
    browser(prefix + '/browser-results-' + actor + '-nov14-' + phase + '.json', actor).nov14;

  function api(id) {
    const evidence = take('isolated-rc/business-api-real.json');
    assert.deepEqual(evidence.runtime, runtime);
    assert.equal(evidence.environment, 'isolated-qa');
    assert.equal(evidence.mode, 'AUTHENTICATED_QA_API');
    assert.equal(evidence.frontendSha, lock.frontendSha);
    assert.equal(evidence.productionDataUsed, false);
    assert.equal(evidence.result, 'PASS');
    assert.equal(evidence.checks.length, 8);
    assert.ok(evidence.calls.some((call) => call.status === 200));
    const check = evidence.checks.find((check) => check.id === id);
    assert.equal(check?.status, 'PASS');
    return check.evidence;
  }

  const fields = () => api('published_fields_files_and_incoterms_survive_owner_edit');
  const variants = () => api('multiple_variants_currency_edit_and_stale_write');
  const late = () => api('late_preparation_blocks_winner_and_submitted_offer_stays_reviewable');
  const refusal = () => api('timely_refusal_requires_reason_and_never_penalizes_service_level');
  const required = () => api('required_fields_server_negatives');
  const csv = () => main('carrierA', 'bid-csv');
  const xlsx = () => main('carrierB', 'bid-xlsx');
  const acceptance = () => main(selection().selection.winnerActor, 'accept').acceptance;
  const ordinary = () => rail('owner', 'finish', 'nov14-ordinary');

  function security() {
    const evidence = take('isolated-rc/security-gate-real.json');
    assert.deepEqual(evidence.runtime, runtime);
    assert.equal(evidence.mocks, false);
    assert.equal(evidence.result, 'PASS');
    assert.equal(evidence.checks.length, 10);
    assert.ok(evidence.checks.every((check) => check.result === 'PASS'));
  }

  function matrix() {
    const file = 'isolated-rc/browser-results-all-cabinet-read.json';
    const actors = [
      'owner',
      'carrierA',
      'carrierB',
      'ved',
      'logistic',
      'supplier',
      'supplierB',
      'designer',
      'content',
      'purchasing',
      'certification',
    ];
    assert.equal(take(file).roles.length, actors.length);
    let cells = 0;
    for (const actor of actors) {
      const role = browser(file, actor);
      assert.deepEqual(role.cabinetMatrixFailures, []);
      assert.deepEqual(role.runtimeErrors, []);
      for (const cell of role.cabinetMatrix) {
        assert.ok([390, 1366].includes(cell.width) && cell.scroll <= cell.width + 4);
        assert.deepEqual(cell.axe.violations, []);
        assert.match(cell.screenshotSha256, hash);
        cells++;
      }
    }
    assert.equal(cells, 96);
  }

  function compatibility() {
    const evidence = take('isolated-rc/previous-production-ui-compatibility.json');
    assert.deepEqual(evidence.runtime, runtime);
    assert.equal(evidence.frontendSha, lock.frontendSha);
    assert.equal(evidence.result, 'PASS');
    assert.equal(evidence.productionApiAccessed, false);
    assert.equal(evidence.productionWrites, false);
    assert.deepEqual(
      evidence.roles.map((role) => role.actor),
      ['owner', 'carrierA'],
    );
    assert.ok(evidence.roles.every((role) => role.status === 'PASS' && role.readOnly === true));
    assert.deepEqual(evidence.transportErrors ?? [], []);
  }

  const rules = [
    [
      'T1-01',
      'owner',
      () =>
        required().serverRejectsMissingFields === true &&
        required().rejectedFields.length === 8 &&
        create().requiredFieldUiValidation.numberOnlyDisabled === true &&
        create().requiredFieldUiValidation.numberAndDeadlineDisabled === true &&
        create().publication.http === 200,
    ],
    [
      'T1-02',
      'owner+carrier',
      () =>
        fields().sourceFieldsAndIncotermPlacePreserved === true &&
        fields().staleEditDenied === true &&
        create().publication.http === 200,
    ],
    [
      'T1-03',
      'owner+carrier+ved+supplier',
      () =>
        fields().ownerOnlyEdit === true &&
        fields().staleEditDenied === true &&
        selection().selection.uniqueWinnerReadback === true,
    ],
    [
      'T1-04',
      'owner+carrier',
      () => fields().sourceFieldsAndIncotermPlacePreserved === true && create().publication.http === 200,
    ],
    [
      'T1-05',
      'owner+carrier',
      () =>
        fields().bitrixNumbers === 2 &&
        create().publication.bitrixNumbers === 2 &&
        /^TR-/.test(create().publication.registrationNumber),
    ],
    [
      'T1-06',
      'owner+carrier',
      () =>
        fields().uploadedTogether === 2 &&
        fields().downloadedByRoles === 3 &&
        fields().removedOnce === true &&
        hash.test(fields().sha256) &&
        create().fileInputs > 0,
    ],
    [
      'T1-07',
      'owner+carrier',
      () =>
        create().publication.recipients === 2 &&
        selection().selection.notificationId &&
        csv().quote.http === 200 &&
        xlsx().quote.http === 200,
    ],
    [
      'T1-08',
      'owner+carrierA+carrierB',
      () =>
        fields().downloadedByRoles === 3 &&
        fields().sourceFieldsAndIncotermPlacePreserved === true &&
        csv().quote.readbackVerified === true &&
        xlsx().quote.readbackVerified === true,
    ],
    [
      'T1-09',
      'owner+carrierA+carrierB+supplier',
      () => {
        security();
        return acceptance().loserDenied === true;
      },
    ],
    [
      'T1-10',
      'all eleven roles',
      () => {
        matrix();
        return true;
      },
    ],
    [
      'T1-11',
      'owner+carrier',
      () => {
        matrix();
        compatibility();
        return true;
      },
    ],
    [
      'T2-01',
      'carrier+owner',
      () =>
        refusal().emptyReasonDenied === true &&
        refusal().ownerCannotImpersonateCarrier === true &&
        refusal().resumedBeforeDeadline === true &&
        csv().quote.http === 200,
    ],
    [
      'T2-02',
      'all eleven roles',
      () => {
        security();
        return acceptance().loserDenied === true && acceptance().vedDeniedBefore === true;
      },
    ],
    [
      'T2-03',
      'certification+owner+carrier',
      () => {
        const e = api('two_sessions_and_three_wrong_passwords');
        return (
          e.oldSessionRevoked === true &&
          e.maximumActiveSessions === 2 &&
          e.wrongAttempts === 3 &&
          e.recoveryRequested === true &&
          csv().quote.http === 200
        );
      },
    ],
    [
      'T2-04',
      'owner+carrier',
      () =>
        late().winnerSelectedAfterSubmission === true &&
        late().lateVariants === 2 &&
        acceptance().vedAvailableAfter === true,
    ],
    [
      'T2-05',
      'owner+carrier',
      () =>
        variants().variants === 2 &&
        variants().replayDidNotDuplicate === true &&
        xlsx().workbookImport.previewConfirmed === true,
    ],
    [
      'T2-06',
      'owner+carrier',
      () =>
        variants().currency === 'EUR' &&
        variants().staleWrite === 409 &&
        variants().forbiddenRoles === 3 &&
        variants().sourceFieldsPreserved === true &&
        selection().selection.comparedBids === 2,
    ],
    [
      'T2-07',
      'carrierB',
      () =>
        xlsx().workbookImport.status === 'PASS' &&
        xlsx().workbookImport.previewConfirmed === true &&
        xlsx().workbookImport.importDidNotSubmit === true &&
        xlsx().quote.readbackVerified === true,
    ],
    [
      'T2-08',
      'carrierA',
      () =>
        csv().csvImport.utf8Bom === true &&
        csv().csvImport.invalidDateRejectedAtomically === true &&
        csv().csvImport.previewConfirmed === true &&
        csv().csvImport.importDidNotSubmit === true &&
        csv().quote.readbackVerified === true,
    ],
    [
      'T2-09',
      'carrier+owner',
      () =>
        refusal().timelyRefusalNoPenalty === true &&
        refusal().resumedBeforeDeadline === true &&
        late().applicationClockUnchanged === true &&
        csv().quote.http === 200,
    ],
    [
      'T2-10',
      'carrier+owner',
      () =>
        late().lateVariants === 2 &&
        late().lateBidDoesNotRestoreScore === true &&
        late().onePenaltyEvent === true &&
        selection().selection.uniqueWinnerReadback === true,
    ],
    [
      'T2-11',
      'carrier+owner',
      () =>
        late().activePreparationWinnerStatus === 409 &&
        late().winnerSelectedAfterSubmission === true &&
        selection().selection.uniqueWinnerReadback === true,
    ],
    [
      'T2-12',
      'owner',
      () => selection().selection.comparedBids === 2 && selection().selection.uniqueWinnerReadback === true,
    ],
    [
      'T2-13',
      'owner+winner+loser',
      () =>
        selection().selection.uniqueWinnerReadback === true &&
        acceptance().loserDenied === true &&
        acceptance().http === 200,
    ],
    [
      'T2-14',
      'owner+carriers',
      () => {
        const a = api('competitive_tender_step_final_protocol_and_role_guard'),
          p = main('owner', 'cabinet-read').tenderPdf;
        return (
          a.step === 15 &&
          a.acceptedImprovement === 20 &&
          a.duplicateOfferProtected === true &&
          a.final === true &&
          p.status === 'PASS' &&
          p.serverValuesVerifiedInPdf === true &&
          p.final === true
        );
      },
    ],
    [
      'T2-15',
      'owner+carrier+ved',
      () =>
        selection().selection.notificationId &&
        late().onePenaltyEvent === true &&
        rail('ved', 'remarks').replayAndReloadDeduplicated === true,
    ],
    [
      'T2-16',
      'carrier+ved',
      () =>
        acceptance().vedDeniedBefore === true &&
        acceptance().vedAvailableAfter === true &&
        acceptance().http === 200 &&
        rail('owner', 'claim-open').noticeSentWithoutFormalAct === true,
    ],
    [
      'T2-17',
      'carrier+owner',
      () => {
        const x = rail(winner('nov14-published'), 'carrier');
        return (
          x.futureRejected === true &&
          x.fourReschedules === true &&
          x.weeklyRows === 10 &&
          x.stationPoints === 2 &&
          x.reloadPreserved === true &&
          x.mutationsAfterReload === 0
        );
      },
    ],
    [
      'T2-18',
      'owner+carrier+ved',
      () => {
        const modes = main('carrierA', 'mode-matrix').modeMatrix;
        const a = api('sea_air_multimodal_shipments_retain_actual_tracking_without_guessed_coordinates');
        return (
          modes.length === 3 &&
          modes.every(
            (m) =>
              m.noGuessedCoordinates === true && m.reloadPreserved === true && m.screenshots.length === 4,
          ) &&
          a.unchangedReplay === true &&
          a.roleDenials === true &&
          rail(winner('nov14-published'), 'carrier').routeStops === 4
        );
      },
    ],
    [
      'T2-19',
      'owner+carrier+ved+logistic',
      () => {
        const v = main('ved', 'ved-work'),
          p = main('ved', 'ved-verify').persistence,
          l = main('logistic', 'logistic-document').documentHandoff,
          s = main('logistic', 'logistic-security').addressedSecurity;
        return (
          v.sharedChat.realRecipients === 3 &&
          v.sharedChat.files === 1 &&
          v.sharedChat.loserDenied === true &&
          p.draftPreserved === true &&
          p.reloadVerified === true &&
          p.submissionRequests === 0 &&
          l.completed === true &&
          l.wrongActorDenied === true &&
          l.ptoReviewUnchanged === true &&
          s.retryDeduplicated === true &&
          s.ptoUnchanged === true
        );
      },
    ],
    [
      'T2-20',
      'owner+carrier+ved',
      () =>
        rail('owner', 'start-review').reviewTask === rail('ved', 'remarks').sameOpenTask &&
        rail('ved', 'remarks').sameOpenTask === rail('ved', 'approve').approvedTask &&
        rail('ved', 'remarks').remarksDeliveredToThreeRoles === true &&
        rail(winner('nov14-published'), 'stages').stagesSaved === true,
    ],
    [
      'T2-21',
      'owner+carrier',
      () =>
        rail(winner('nov14-published'), 'stages').stagesSaved === true &&
        ordinary().ordinaryCompletion.noContainer === true &&
        ordinary().ordinaryCompletion.explicitOwnerDecision === true &&
        ordinary().ordinaryCompletion.replayIdempotent === true,
    ],
    [
      'T2-22',
      'owner+carrier',
      () =>
        ordinary().ordinaryCompletion.noClaim === true &&
        ordinary().ordinaryCompletion.carrierDenied === true &&
        ordinary().completedAndArchived === true &&
        ordinary().dashboardAgrees === true &&
        rail('owner', 'approve-cost', 'nov14-ordinary').finalCostApproved.ownerOnly === true,
    ],
    [
      'T2-23',
      'owner+carrier',
      () =>
        rail('owner', 'claim-open').noticeSentWithoutFormalAct === true &&
        rail(winner('nov14-published'), 'claim-propose').carrierProposed === true &&
        rail('owner', 'claim-approve').exactProposalApproved === true &&
        rail(winner('nov14-published'), 'claim-fulfill').freshOwnProofSubmitted === true &&
        rail('owner', 'claim-resolve').claimSettledWithoutAutomaticShipmentCompletion === true &&
        rail('owner', 'finish').completedAndArchived === true &&
        rail('owner', 'approve-cost-revision').finalCostApproved.staleApprovalDenied === true,
    ],
    [
      'T2-24',
      'carrier+owner',
      () =>
        late().onePenaltyEvent === true &&
        late().lateBidDoesNotRestoreScore === true &&
        refusal().timelyRefusalNoPenalty === true &&
        csv().quote.http === 200,
    ],
    [
      'T2-25',
      'owner+carrier+ved',
      () =>
        fields().sourceFieldsAndIncotermPlacePreserved === true &&
        fields().bitrixNumbers === 2 &&
        variants().sourceFieldsPreserved === true &&
        create().publication.bitrixNumbers === 2 &&
        rail('owner', 'finish').dashboardAgrees === true,
    ],
    [
      'T2-26',
      'all eleven roles',
      () => {
        matrix();
        compatibility();
        const x = main('owner', 'alignment');
        return (
          x.alignment.processEditor.reopened === true &&
          x.alignment.processEditor.approvedModelUnchanged === true &&
          x.publicSupport.publicFormSubmitted === true &&
          x.publicSupport.foreignReadsAndWritesDenied === true
        );
      },
    ],
  ];
  const performance = take('isolated-rc/issue99-real-performance.json');
  assert.equal(performance.status, 'PASS');
  assert.equal(performance.mocks, false);
  assert.equal(performance.frontendSha, lock.frontendSha);
  assert.equal(performance.backendSourceCommit, lock.backendSha);
  assert.equal(performance.backendVersion, runtime.version);
  assert.equal(performance.backendBundle, runtime.bundle);
  assert.equal(performance.roles.length, 3);
  for (const role of performance.roles) {
    assert.equal(role.samples.length, 15);
    assert.ok(role.samples.every((sample) => sample.status === 200) && role.p95Ms < 5000);
  }

  const scenarios = rules.map(([id, actorRole, check]) => {
    refs = [];
    try {
      assert.ok(check(), 'Required observed behavior did not pass');
      assert.ok(
        refs.some((source) => source.file.includes('browser-results-')),
        'Missing authenticated browser proof',
      );
    } catch (error) {
      throw new Error('LOCKED_E2E_SCENARIO_FAILED:' + id, {cause: error});
    }
    const sources = [...new Map(refs.map((source) => [source.file, source])).values()];
    return {
      id,
      actorRole,
      status: 'PASS',
      mode: 'AUTHENTICATED_QA_API',
      evidence: {
        method: 'HTTP_AND_BROWSER',
        responseVerified: true,
        traceId: digest(JSON.stringify(sources)),
        sources,
      },
    };
  });
  assert.equal(scenarios.length, 37);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 37);
  const e2e = {...run, environment: 'isolated-qa', authorized: true, criticalDefects: [], scenarios};
  const report = JSON.stringify(e2e) + '\n';
  return {
    report,
    pair: {
      ...run,
      generatedAt: new Date(now).toISOString(),
      servedFrontendSha: lock.frontendSha,
      servedApiVerified: true,
      stagingUrl,
      qaProject,
      apiFunction: runtime.function,
      apiVersion: runtime.version,
      apiBundleSha256: runtime.bundle,
      qaEntrySha256: runtime.qaEntrySha256,
      servedIndexSha256: runtime.servedHashes['index.html'],
      servedAppSha256: runtime.servedHashes['app.js'],
      e2eReportSha256: digest(report),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [before, after, reports, output] = process.argv.slice(2);
  const lock = readLock();
  const run = runReceipt(lock, 'e2e');
  const runtime = readJson(before);
  const {report, pair} = compileE2e(
    lock,
    runtime,
    readJson(after),
    reports,
    run,
    Date.parse(runtime.observedAt),
  );
  mkdirSync(output);
  writeFileSync(join(output, 'private-authenticated-e2e.json'), report, {flag: 'wx', mode: 0o600});
  writeFileSync(join(output, 'release-gate-pair.json'), JSON.stringify(pair) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('LOCKED_E2E_37_OF_37_VERIFIED');
}
