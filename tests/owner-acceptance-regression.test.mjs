import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runtimeAssetUrl } from './helpers/runtime-assets.mjs';

const productionOwner = readFileSync('owner-registers-20261111.js', 'utf8');
const stagingOwner = readFileSync('test/owner-registers-20261111.js', 'utf8');

test('production and staging use the same current Owner register implementation', () => {
  assert.equal(productionOwner, stagingOwner);
  assert.ok(productionOwner.includes('acceptanceExecutions'));
  assert.ok(productionOwner.includes('acceptanceExecutionFor'));
  assert.ok(productionOwner.includes('acceptedByOwner'));
  assert.ok(productionOwner.includes('owner-register-execution'));
  assert.ok(productionOwner.includes("action:'transfer'"));
});

test('Owner acceptance is driven by the server execution ledger, not browser status mutation', () => {
  assert.ok(productionOwner.includes("decision==='accepted'"));
  assert.ok(productionOwner.includes("decision==='review_pending'"));
  assert.ok(!productionOwner.includes("action:'set_status'"));
  assert.ok(!productionOwner.includes('acceptanceDialog'));
});

test('both entry points pin the exact same Owner register asset hash', () => {
  const asset = runtimeAssetUrl('owner-registers-20261111.js');
  assert.ok(readFileSync('index.html', 'utf8').includes(asset), 'production index must pin the current Owner register asset');
  assert.ok(readFileSync('test/index.html', 'utf8').includes(asset), 'staging index must pin the same Owner register asset');
});
