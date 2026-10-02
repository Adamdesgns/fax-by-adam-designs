import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FaxCore } from '../src/fax-core.js';
import { FaxStore } from '../src/store.js';
import { Phaxio } from '../src/phaxio.js';
import { startWeb } from '../src/web.js';

async function setup(t, send = async () => '123') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'signlocal-fax-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'fixture.pdf'); await fs.writeFile(file, '%PDF-1.4\nsynthetic only');
  const store = new FaxStore(path.join(root, 'data'));
  const core = new FaxCore({ store, allowedRoots: [root], provider: { ready: true, send, status: async () => ({ status: 'delivered', isTest: false }) } });
  const job = await core.prepare({ documentPath: file, recipientName: 'Test', recipientFax: '+12025550123', subject: 'Synthetic' });
  const approval = { ownerConfirmed: true, recipientFax: '+12025550123', documentSha256: job.documentSha256 };
  return { core, job, approval, file, root };
}
test('approval must match exact bytes and recipient; modified files never send', async t => {
  let sends = 0; const { core, job, approval, file } = await setup(t, async () => { sends++; return '123'; });
  await assert.rejects(core.send(job.id, { ...approval, recipientFax: '+12025550124' }), /Approval/);
  await fs.appendFile(file, 'changed');
  await assert.rejects(core.send(job.id, approval), /Document changed/);
  assert.equal(sends, 0);
});
test('parallel sends and later repeated sends produce only one provider request', async t => {
  let sends = 0; const { core, job, approval } = await setup(t, async () => { sends++; await new Promise(r => setTimeout(r, 30)); return '123'; });
  const results = await Promise.allSettled([core.send(job.id, approval), core.send(job.id, approval)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(sends, 1); assert.equal((await core.get(job.id)).status, 'queued');
  await assert.rejects(core.send(job.id, approval));
  assert.equal((await core.refresh(job.id)).status, 'delivered');
});
test('timeout stays unknown and cannot be retried', async t => {
  let sends = 0; const { core, job, approval } = await setup(t, async () => { sends++; throw new Error('timeout'); });
  await assert.rejects(core.send(job.id, approval), /uncertain/);
  assert.equal((await core.get(job.id)).status, 'unknown');
  await assert.rejects(core.send(job.id, approval)); assert.equal(sends, 1);
});
test('Phaxio posts private binary PDF and labels test success as test', async () => {
  const provider = new Phaxio({ key: 'test-key', secret: 'test-secret', fetcher: async (url, options) => {
    assert.equal(options.redirect, 'error');
    if (options.method === 'POST') { assert.equal(options.body.get('to'), '+12025550123'); assert.equal(await options.body.get('file').text(), '%PDF-test'); return { ok: true, json: async () => ({ success: true, data: { id: 123 } }) }; }
    return { ok: true, json: async () => ({ success: true, data: { status: 'success', is_test: true } }) };
  } });
  assert.equal(await provider.send({ id: 'job', recipientFax: '+12025550123' }, Buffer.from('%PDF-test')), '123');
  assert.equal((await provider.status('123')).status, 'test');
});
test('web API blocks unauthenticated and foreign-origin requests', async t => {
  const { core } = await setup(t); const web = await startWeb(core);
  t.after(() => new Promise(r => web.server.close(r)));
  assert.equal((await fetch(web.origin + '/api/fax/status')).status, 401);
  assert.equal((await fetch(web.origin + '/api/fax/status', { headers: { Authorization: `Bearer ${web.token}`, Origin: 'https://evil.example' } })).status, 403);
  const response = await fetch(web.origin + '/api/fax/status', { headers: { Authorization: `Bearer ${web.token}` } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).realTransmissionReady, true);
});
test('concurrent store instances preserve both jobs', async t => {
  const { root } = await setup(t); const a = new FaxStore(path.join(root, 'shared')); const b = new FaxStore(path.join(root, 'shared'));
  await Promise.all([a.add({ id: 'a' }), b.add({ id: 'b' })]);
  assert.equal((await a.read()).jobs.length, 2);
});
