import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const zip = path.resolve(process.argv[2] || path.join(root, 'release', `faxdock-${pkg.version}-local.zip`));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'faxdock-release-proof-'));
const extracted = path.join(temp, 'extracted');
const privateData = path.join(temp, 'private');
let client;
try {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:OPENFAX_SMOKE_ZIP, $env:OPENFAX_SMOKE_DEST)'], { env: { ...process.env, OPENFAX_SMOKE_ZIP: zip, OPENFAX_SMOKE_DEST: extracted }, stdio: 'pipe' });
  const manifest = JSON.parse(await fs.readFile(path.join(extracted, 'plugin.json'), 'utf8'));
  const overlay = JSON.parse(await fs.readFile(path.join(extracted, '.codex-plugin/plugin.json'), 'utf8'));
  const portable = JSON.parse(await fs.readFile(path.join(extracted, 'mcp.json'), 'utf8'));
  const compat = JSON.parse(await fs.readFile(path.join(extracted, '.mcp.json'), 'utf8'));
  assert.equal(manifest.name, 'faxdock'); assert.equal(manifest.version, pkg.version);
  assert.equal(overlay.interface.displayName, 'Fax by Adam Designs');
  assert.equal(portable.mcpServers.faxdock.type, 'stdio');
  assert.equal(portable.mcpServers.faxdock.env.FAX_TRANSPORT, 'disabled');
  assert.equal(compat.mcpServers.faxdock.command, portable.mcpServers.faxdock.command);
  for (const forbidden of ['.env', 'data', '.git', 'test', 'release', 'SUBMISSION-READINESS.md', 'review-cases.draft.json']) {
    assert.equal(await fs.access(path.join(extracted, forbidden)).then(() => true, () => false), false, `${forbidden} leaked into package`);
  }
  await fs.mkdir(privateData);
  const pdf = path.join(privateData, 'synthetic.pdf');
  await fs.writeFile(pdf, '%PDF-1.4\nsynthetic-package-proof\n%%EOF');
  const expand = value => value.replaceAll('${PLUGIN_ROOT}', extracted).replaceAll('${PLUGIN_DATA}', privateData);
  const server = portable.mcpServers.faxdock;
  const env = Object.fromEntries(Object.entries(server.env).map(([key, value]) => [key, expand(value)]));
  client = new Client({ name: 'faxdock-package-proof', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: server.args.map(expand), cwd: extracted, env: { ...process.env, ...env, PHAXIO_API_KEY: 'synthetic', PHAXIO_API_SECRET: 'synthetic' } }));
  const tools = await client.listTools(); assert.equal(tools.tools.length, 9);
  const call = async (name, args = {}) => { const result = await client.callTool({ name, arguments: args }); assert.equal(Boolean(result.isError), false, `${name} failed`); return JSON.parse(result.content[0].text); };
  assert.equal((await call('fax_system_status')).realTransmissionReady, false);
  const job = await call('prepare_fax', { documentPath: pdf, recipientName: 'Example Recipient', recipientFax: '+12025550123', subject: 'Synthetic local proof' });
  assert.equal(job.status, 'draft'); assert.equal(job.recipientFax, '***-***-0123');
  assert.equal((await call('list_faxes')).length, 1);
  assert.equal((await call('get_fax', { id: job.id })).documentSha256, job.documentSha256);
  const locked = await client.callTool({ name: 'send_fax', arguments: { id: job.id, ownerConfirmed: true, recipientFax: '+12025550123', documentSha256: job.documentSha256 } });
  assert.equal(locked.isError, true); assert.match(locked.content[0].text, /locked/);
  const web = await call('open_signlocal_fax');
  const session = new URL(web.url); const token = new URLSearchParams(session.hash.slice(1)).get('fax');
  const page = await fetch(session.origin); assert.equal(page.status, 200); assert.match(await page.text(), /Fax by Adam Designs/);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const simulated = await fetch(session.origin + '/api/fax/simulate', { method: 'POST', headers, body: JSON.stringify({ id: job.id }) });
  assert.equal(simulated.status, 200); assert.equal((await simulated.json()).status, 'simulated');
  assert.equal((await call('cancel_fax', { id: job.id })).status, 'cancelled');
  const refresh = await client.callTool({ name: 'refresh_fax', arguments: { id: job.id } }); assert.equal(refresh.isError, true);
  console.log(JSON.stringify({ package: path.basename(zip), identity: manifest.name, version: manifest.version, tools: tools.tools.length, cleanInstall: 'pass', localWorkflow: 'pass', bundledViewer: 'pass', realSend: 'locked', providerCalls: 0 }));
} finally {
  try { if (client) await client.close(); } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
