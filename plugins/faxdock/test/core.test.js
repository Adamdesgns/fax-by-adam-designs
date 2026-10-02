import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { FaxCore, normalizeFaxNumber } from '../src/fax-core.js';
import { FaxStore } from '../src/store.js';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'adam-fax-'));
  const pdf = path.join(root, 'sample.pdf');
  await fs.writeFile(pdf, '%PDF-1.4\n%%EOF\n');
  const store = new FaxStore(path.join(root, 'data'));
  const core = new FaxCore({
    store,
    allowedRoots: [root],
    transport: 'disabled',
    statusProvider: () => ({ realTransmissionReady: false, blocker: 'Test transport disabled.' }),
  });
  return { root, pdf, core };
}

test('normalizes a US fax number', () => {
  assert.equal(normalizeFaxNumber('(855) 641-6935'), '+18556416935');
});

test('prepares, masks, lists, and simulates a PDF fax', async () => {
  const { pdf, core } = await fixture();
  const draft = await core.prepare({
    documentPath: pdf,
    recipientName: 'IRS EIN Operation',
    recipientFax: '855-641-6935',
    subject: 'Test only',
  });
  assert.equal(draft.status, 'draft');
  assert.equal(draft.recipientFax, '***-***-6935');
  assert.equal((await core.list()).length, 1);
  const simulated = await core.simulate(draft.id);
  assert.equal(simulated.status, 'simulated');
  assert.equal(simulated.attempts[0].transport, 'simulation');
});

test('rejects documents outside allowed roots', async () => {
  const { core } = await fixture();
  await assert.rejects(
    core.prepare({
      documentPath: path.resolve(os.tmpdir(), '..', 'outside.pdf'),
      recipientName: 'Nobody',
      recipientFax: '855-641-6935',
      subject: 'Blocked',
    }),
    /outside the connector allowed roots/,
  );
});

test('real transmission fails closed', async () => {
  const { core } = await fixture();
  await assert.rejects(core.send('unused'), /Real fax transmission is locked/);
});
