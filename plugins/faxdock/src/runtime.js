import { config } from './config.js';
import { FaxCore } from './fax-core.js';
import { FaxStore } from './store.js';
import { Phaxio } from './phaxio.js';

export function createCore({ settings = config, env = process.env } = {}) {
  // Credentials alone never enable transmission. Unknown transports fail closed.
  const enabled = settings.transport === 'phaxio';
  return new FaxCore({ store: new FaxStore(settings.dataDir), allowedRoots: settings.allowedRoots,
    transport: enabled ? 'phaxio' : 'disabled',
    provider: enabled ? new Phaxio({ key: env.PHAXIO_API_KEY, secret: env.PHAXIO_API_SECRET }) : undefined });
}
