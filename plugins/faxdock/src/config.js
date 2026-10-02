import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(PROJECT_ROOT, '.env')); }
catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot read local fax configuration.'); }

function splitRoots(value) {
  if (!value) return [path.resolve(PROJECT_ROOT, '..')];
  return value
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
}

export const config = Object.freeze({
  projectRoot: PROJECT_ROOT,
  dataDir: path.resolve(process.env.FAX_DATA_DIR || path.join(PROJECT_ROOT, 'data')),
  allowedRoots: splitRoots(process.env.FAX_ALLOWED_ROOTS),
  transport: process.env.FAX_TRANSPORT || 'disabled',
});
