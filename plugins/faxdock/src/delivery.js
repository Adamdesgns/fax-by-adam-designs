import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const MAX_FAX_BYTES = 19 * 1024 * 1024; // Leave room in Phaxio's 20 MB request limit.

// Exclusive disk lock covers Codex, Claude and browser processes using the same store.
export async function withJobLock(store, id, action) {
  if (!/^(?:[a-z0-9-]{36}|[a-f0-9]{64})$/i.test(id)) throw new Error('Invalid job ID.');
  await fs.mkdir(store.dataDir, { recursive: true });
  const lock = path.join(store.dataDir, `${id}.lock`);
  let handle;
  try { handle = await fs.open(lock, 'wx'); } catch { throw new Error('Job is busy or interrupted. Inspect its receipt before retrying.'); }
  try { return await action(); } finally { await handle.close(); await fs.unlink(lock); }
}

export async function deliver(core, id, approval) {
  if (!core.provider?.ready) throw new Error('Real fax transmission is locked. Connect Phaxio credentials locally first.');
  const initial = (await core.store.read()).jobs.find(j => j.id === id);
  if (!initial) throw new Error('Unknown fax job.');
  const contentLock = digest(`${initial.documentSha256}:${initial.recipientFax}`);
  return withJobLock(core.store, contentLock, async () => {
    const job = (await core.store.read()).jobs.find(j => j.id === id);
    if (!job || job.status !== 'draft') throw new Error('Only a fresh draft can be sent. Never retry an uncertain transmission.');
    const duplicate = (await core.store.read()).jobs.some(j => j.id !== id && j.documentSha256 === job.documentSha256 && j.recipientFax === job.recipientFax && ['sending', 'queued', 'unknown', 'delivered'].includes(j.status));
    if (duplicate) throw new Error('This exact document already has an active or delivered fax to this recipient.');
    if (!approval?.ownerConfirmed || approval.recipientFax !== job.recipientFax || approval.documentSha256 !== job.documentSha256) {
      throw new Error('Approval must match the reviewed recipient and exact PDF hash.');
    }
    const bytes = await fs.readFile(job.documentPath);
    if (bytes.length > MAX_FAX_BYTES || digest(bytes) !== job.documentSha256) throw new Error('Document changed. Prepare and review a new draft.');
    await core.store.update(id, j => ({ ...j, status: 'sending', updatedAt: new Date().toISOString() }));
    let providerId;
    try { providerId = await core.provider.send(job, bytes); }
    catch {
      await core.store.update(id, j => ({ ...j, status: 'unknown', updatedAt: new Date().toISOString() }));
      throw new Error('Delivery is uncertain. Do not resend. Check the provider dashboard for this job ID.');
    }
    const updated = await core.store.update(id, j => ({ ...j, status: 'queued', providerId, updatedAt: new Date().toISOString() }));
    return core.publicJob(updated);
  });
}
