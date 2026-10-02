import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { FaxCore } from './fax-core.js';
import { FaxStore } from './store.js';
import { getSystemStatus } from './system-status.js';
import { createCore } from './runtime.js';
import { startWeb } from './web.js';

function result(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

export function buildServer(overrides = {}) {
  const store = overrides.store || new FaxStore(config.dataDir);
  const core = overrides.core || createCore();
  let web;

  const server = new McpServer({ name: 'faxdock', title: 'Fax by Adam Designs', version: '1.3.0' });

  server.registerTool('open_signlocal_fax', {
    title: 'Open SignLocal fax workspace',
    description: 'Start a private local SignLocal session for editing, recipient review and faxing. Returns a session link; opening does not transmit documents.',
    inputSchema: z.object({}),
  }, async () => {
    try { web ||= await startWeb(core); return result({ url: web.url, ...core.systemStatus() }); }
    catch { return failure(new Error('Unable to start local SignLocal fax workspace.')); }
  });

  server.registerTool('refresh_fax', {
    title: 'Check provider delivery receipt',
    description: 'Read delivery status from Phaxio. Test receipts are always labeled test; queued is not delivered.',
    inputSchema: z.object({ id: z.string().uuid() }),
  }, async ({ id }) => { try { return result(await core.refresh(id)); } catch (error) { return failure(error); } });

  server.registerTool(
    'fax_system_status',
    {
      title: 'Check fax system status',
      description: 'Inspect the configured fax transport and whether provider sending is enabled. Does not contact a provider.',
      inputSchema: z.object({}),
    },
    async () => result(core.systemStatus()),
  );

  server.registerTool(
    'prepare_fax',
    {
      title: 'Prepare a fax draft',
      description: 'Validate a local PDF and create a draft fax job. This does not transmit anything.',
      inputSchema: z.object({
        documentPath: z.string().min(1).describe('Absolute path to a PDF inside an allowed root'),
        recipientName: z.string().min(1),
        recipientFax: z.string().min(10),
        subject: z.string().min(1),
        coverNote: z.string().max(1200).optional(),
      }),
    },
    async (input) => {
      try { return result(await core.prepare(input)); } catch (error) { return failure(error); }
    },
  );

  server.registerTool(
    'list_faxes',
    {
      title: 'List fax jobs',
      description: 'List local fax job metadata with recipient numbers masked.',
      inputSchema: z.object({}),
    },
    async () => result(await core.list()),
  );

  server.registerTool(
    'get_fax',
    {
      title: 'Get a fax job',
      description: 'Get one local fax job with the recipient number masked.',
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) => {
      try { return result(await core.get(id)); } catch (error) { return failure(error); }
    },
  );

  server.registerTool(
    'simulate_fax',
    {
      title: 'Simulate fax delivery',
      description: 'Run a local non-transmitting delivery simulation for a draft fax.',
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) => {
      try { return result(await core.simulate(id)); } catch (error) { return failure(error); }
    },
  );

  server.registerTool(
    'cancel_fax',
    {
      title: 'Cancel a local fax draft',
      description: 'Mark a draft or simulated local fax job as cancelled. This does not delete records or files.',
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) => {
      try { return result(await core.cancel(id)); } catch (error) { return failure(error); }
    },
  );

  server.registerTool(
    'send_fax',
    {
      title: 'Send an approved fax',
      description: 'Upload the exact reviewed PDF to Phaxio and send to the approved fax number. Provider charges may apply. Requires explicit user approval of this document and recipient. Never retry uncertain delivery.',
      inputSchema: z.object({
        id: z.string().uuid(),
        ownerConfirmed: z.literal(true).describe('Must reflect explicit owner approval immediately before transmission'),
        recipientFax: z.string().describe('Exact reviewed fax number including +country code'),
        documentSha256: z.string().regex(/^[a-f0-9]{64}$/).describe('Hash from the reviewed prepared job'),
      }),
    },
    async (approval) => {
      try { return result(await core.send(approval.id, approval)); } catch (error) { return failure(error); }
    },
  );

  return server;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  void serveStdio(() => buildServer());
  console.error('Fax by Adam Designs MCP server listening on stdio');
}
