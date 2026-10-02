import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, MAX_FAX_BYTES, deliver } from './delivery.js';

function isInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function normalizeFaxNumber(value) {
  const digits = String(value).replace(/\D/g, '');
  const normalized = digits.length === 10 ? `1${digits}` : digits;
  if (normalized.length < 11 || normalized.length > 15) {
    throw new Error('Fax number must contain a country code and 10-14 additional digits.');
  }
  return `+${normalized}`;
}

export function maskFaxNumber(value) {
  return `***-***-${value.slice(-4)}`;
}

export class FaxCore {
  constructor({ store, allowedRoots, transport, statusProvider, provider }) {
    this.provider = provider;
    this.store = store;
    this.allowedRoots = allowedRoots;
    this.transport = transport;
    this.statusProvider = statusProvider;
  }

  systemStatus() {
    return { provider: 'Phaxio', transport: this.transport, realTransmissionReady: Boolean(this.provider?.ready), blocker: this.provider?.ready ? null : this.transport === 'disabled' ? 'Fax transport is disabled. Configure FAX_TRANSPORT=phaxio and credentials locally to enable it.' : 'Phaxio credentials are not configured. No fax can be sent.' };
  }

  async prepare({ documentPath, recipientName, recipientFax, subject, coverNote = '' }) {
    if (!this.allowedRoots.some(root => isInside(path.resolve(documentPath), root))) throw new Error('Document is outside the connector allowed roots.');
    const absolutePath = await fs.realpath(path.resolve(documentPath));
    if (!this.allowedRoots.some((root) => isInside(absolutePath, root))) {
      throw new Error('Document is outside the connector allowed roots.');
    }
    const stat = await fs.stat(absolutePath);
    if (stat.size > MAX_FAX_BYTES) throw new Error('Fax PDF must be under 19 MB.');
    if (!stat.isFile()) throw new Error('Document path is not a file.');
    if (path.extname(absolutePath).toLowerCase() !== '.pdf') {
      throw new Error('The first connector version accepts PDF documents only.');
    }
    const header = await fs.open(absolutePath, 'r');
    try {
      const bytes = Buffer.alloc(5);
      await header.read(bytes, 0, 5, 0);
      if (bytes.toString('ascii') !== '%PDF-') throw new Error('Document is not a valid PDF file.');
    } finally {
      await header.close();
    }

    const normalizedFax = normalizeFaxNumber(recipientFax);
    const documentSha256 = digest(await fs.readFile(absolutePath));
    const prior = (await this.store.read()).jobs.find(j => j.documentSha256 === documentSha256 && j.recipientFax === normalizedFax && ['sending', 'queued', 'unknown', 'delivered'].includes(j.status));
    if (prior) throw new Error(`This PDF already has an active or delivered fax to that number. Inspect job ${prior.id} before creating another.`);
    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      documentPath: absolutePath,
      documentName: path.basename(absolutePath),
      documentBytes: stat.size,
      documentSha256,
      recipientName,
      recipientFax: normalizedFax,
      subject,
      coverNote,
      transport: this.transport,
      attempts: [],
    };
    await this.store.add(job);
    return this.publicJob(job);
  }

  async list() {
    const state = await this.store.read();
    return state.jobs.map((job) => this.publicJob(job));
  }

  async get(id) {
    const state = await this.store.read();
    const job = state.jobs.find((item) => item.id === id);
    if (!job) throw new Error(`Unknown fax job: ${id}`);
    return this.publicJob(job);
  }

  async cancel(id) {
    const updated = await this.store.update(id, (job) => {
      if (!['draft', 'simulated'].includes(job.status)) {
        throw new Error(`Fax job in status ${job.status} cannot be cancelled.`);
      }
      const now = new Date().toISOString();
      return { ...job, status: 'cancelled', updatedAt: now };
    });
    return this.publicJob(updated);
  }

  async simulate(id) {
    const updated = await this.store.update(id, (job) => {
      if (job.status !== 'draft') throw new Error('Only draft fax jobs can be simulated.');
      const now = new Date().toISOString();
      return {
        ...job,
        status: 'simulated',
        updatedAt: now,
        attempts: [...job.attempts, { at: now, transport: 'simulation', result: 'delivered' }],
      };
    });
    return this.publicJob(updated);
  }

  async send(id, approval) { return deliver(this, id, approval); }

  async refresh(id) {
    const job = (await this.store.read()).jobs.find(j => j.id === id);
    if (!job?.providerId) throw new Error('No provider receipt. Check the provider dashboard if delivery is uncertain.');
    const receipt = await this.provider.status(job.providerId);
    return this.publicJob(await this.store.update(id, j => ({ ...j, ...receipt, updatedAt: new Date().toISOString() })));
  }

  publicJob(job) {
    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      documentName: job.documentName,
      documentBytes: job.documentBytes,
      documentSha256: job.documentSha256,
      providerId: job.providerId,
      isTest: job.isTest,
      pages: job.pages,
      costCents: job.costCents,
      completedAt: job.completedAt,
      recipientName: job.recipientName,
      recipientFax: maskFaxNumber(job.recipientFax),
      subject: job.subject,
      transport: job.transport,
      attempts: job.attempts,
    };
  }
}
