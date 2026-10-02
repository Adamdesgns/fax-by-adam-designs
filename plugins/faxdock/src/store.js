import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY_STATE = Object.freeze({ version: 1, jobs: [] });

export class FaxStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, 'fax-jobs.json');
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      await fs.access(this.statePath);
    } catch {
      try { await fs.writeFile(this.statePath, JSON.stringify(EMPTY_STATE), { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }

  async read() {
    await this.init();
    const raw = await fs.readFile(this.statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.jobs)) {
      throw new Error('Fax state file has an unsupported shape.');
    }
    return parsed;
  }

  async add(job) {
    return this.#mutate((state) => ({ ...state, jobs: [...state.jobs, job] }));
  }

  async update(id, updater) {
    let updated;
    await this.#mutate((state) => {
      const jobs = state.jobs.map((job) => {
        if (job.id !== id) return job;
        updated = updater(job);
        return updated;
      });
      if (!updated) throw new Error(`Unknown fax job: ${id}`);
      return { ...state, jobs };
    });
    return updated;
  }

  async #mutate(fn) {
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      const lockPath = path.join(this.dataDir, 'store.lock');
      let lock;
      for (let attempt = 0; attempt < 100; attempt++) {
        try { lock = await fs.open(lockPath, 'wx'); break; }
        catch (error) { if (error.code !== 'EEXIST') throw error; await new Promise(resolve => setTimeout(resolve, 50)); }
      }
      if (!lock) throw new Error('Fax store is locked. Inspect interrupted jobs before recovery.');
      try {
        const state = await this.read();
        const next = fn(state);
        await this.#write(next);
        return next;
      } finally { await lock.close(); await fs.unlink(lockPath); }
    });
    return this.writeChain;
  }

  async #write(state) {
    await fs.mkdir(this.dataDir, { recursive: true });
    const temp = `${this.statePath}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await fs.rename(temp, this.statePath);
  }
}
