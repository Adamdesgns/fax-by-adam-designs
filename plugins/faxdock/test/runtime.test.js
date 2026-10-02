import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createCore } from '../src/runtime.js';

const settings = { dataDir: path.join(os.tmpdir(), 'unused-fax-runtime-test'), allowedRoots: [os.tmpdir()] };
const credentials = { PHAXIO_API_KEY: 'synthetic-key', PHAXIO_API_SECRET: 'synthetic-secret' };

for (const transport of ['disabled', 'windows-fax', 'unknown', undefined]) {
  test('transport ' + transport + ' stays locked even with credentials', async () => {
    const core = createCore({ settings: { ...settings, transport }, env: credentials });
    assert.equal(core.systemStatus().realTransmissionReady, false);
    assert.equal(core.systemStatus().transport, 'disabled');
    await assert.rejects(core.send('unused'), /Real fax transmission is locked/);
  });
}

test('Phaxio requires both explicit transport selection and credentials', () => {
  const configured = { ...settings, transport: 'phaxio' };
  assert.equal(createCore({ settings: configured, env: {} }).systemStatus().realTransmissionReady, false);
  assert.equal(createCore({ settings: configured, env: { PHAXIO_API_KEY: 'synthetic-key' } }).systemStatus().realTransmissionReady, false);
  assert.equal(createCore({ settings: configured, env: credentials }).systemStatus().realTransmissionReady, true);
});
