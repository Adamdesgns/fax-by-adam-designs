import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fax-mcp-smoke-'));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, 'src', 'server.js')],
  env: {
    ...process.env,
    FAX_DATA_DIR: dataDir,
    FAX_ALLOWED_ROOTS: path.resolve(root, '..'),
    FAX_TRANSPORT: 'disabled',
    PHAXIO_API_KEY: 'synthetic-smoke-key',
    PHAXIO_API_SECRET: 'synthetic-smoke-secret',
  },
});
const client = new Client({ name: 'faxdock-smoke', version: '0.1.0' });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  const expected = ['cancel_fax', 'fax_system_status', 'get_fax', 'list_faxes', 'open_signlocal_fax', 'prepare_fax', 'refresh_fax', 'send_fax', 'simulate_fax'];
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tools: ${names.join(', ')}`);
  }
  const status = await client.callTool({ name: 'fax_system_status', arguments: {} });
  if (status.isError) throw new Error('fax_system_status returned an error');
  if (JSON.parse(status.content[0].text).realTransmissionReady !== false) {
    throw new Error('Disabled transport became ready with synthetic credentials');
  }
  const locked = await client.callTool({
    name: 'send_fax',
    arguments: { id: '00000000-0000-4000-8000-000000000000', ownerConfirmed: true, recipientFax: '+12025550123', documentSha256: '0'.repeat(64) },
  });
  if (!locked.isError || !locked.content?.[0]?.text?.includes('Real fax transmission is locked')) {
    throw new Error('send_fax did not fail closed');
  }
  process.stdout.write(`${JSON.stringify({ tools: names, status: 'ok', realSend: 'locked' })}\n`);
} finally {
  try { await client.close(); } finally { await fs.rm(dataDir, { recursive: true, force: true }); }
}
