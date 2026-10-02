import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createCore } from './runtime.js';
import { MAX_FAX_BYTES } from './delivery.js';

const siblingDist = path.resolve(config.projectRoot, '../public-pdf-signer/dist');
const bundledDist = path.join(config.projectRoot, 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

export async function startWeb(core = createCore(), port = 0) {
  let dist = bundledDist;
  try { await fs.access(path.join(siblingDist, 'index.html')); dist = siblingDist; } catch { /* Self-contained review viewer. */ }
  const token = randomBytes(32).toString('hex');
  let origin;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
    const json = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) return json(403, { error: 'Local session only.' });
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith('/api/fax/')) {
        if (req.headers.authorization !== `Bearer ${token}`) return json(401, { error: 'Open the session link from Codex to connect fax.' });
        if (req.method === 'GET' && url.pathname === '/api/fax/status') return json(200, core.systemStatus());
        if (req.method === 'GET' && url.pathname === '/api/fax/jobs') return json(200, { jobs: await core.list() });
        if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return json(405, { error: 'JSON POST required.' });
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 27 * 1024 * 1024) throw new Error('Request too large.'); chunks.push(chunk); }
        const input = JSON.parse(Buffer.concat(chunks).toString());
        if (url.pathname === '/api/fax/prepare') {
          if (typeof input.pdf !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(input.pdf)) throw new Error('PDF is required.');
          if (typeof input.recipientName !== 'string' || !input.recipientName.trim() || input.recipientName.length > 150) throw new Error('Recipient name required (150 characters maximum).');
          if (typeof input.recipientFax !== 'string' || !/^\+?[\d ()-]{10,25}$/.test(input.recipientFax)) throw new Error('Enter a valid recipient fax number.');
          const bytes = Buffer.from(input.pdf, 'base64');
          if (bytes.length > MAX_FAX_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Choose a PDF under 19 MB.');
          const folder = path.join(config.dataDir, 'documents'); await fs.mkdir(folder, { recursive: true });
          const file = path.join(folder, `${randomUUID()}.pdf`);
          await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
          try {
            const job = await core.prepare({ documentPath: file, recipientName: input.recipientName, recipientFax: input.recipientFax, subject: 'SignLocal document' });
            return json(200, job);
          } catch (error) { await fs.unlink(file); throw error; }
        }
        if (url.pathname === '/api/fax/send') return json(200, await core.send(input.id, input));
        if (url.pathname === '/api/fax/refresh') return json(200, await core.refresh(input.id));
        if (url.pathname === '/api/fax/simulate') return json(200, await core.simulate(input.id));
        if (url.pathname === '/api/fax/cancel') return json(200, await core.cancel(input.id));
        return json(404, { error: 'Unknown action.' });
      }
      if (req.method !== 'GET') return json(405, { error: 'GET required.' });
      // No service worker in the companion: session URLs and API must never be cached.
      if (url.pathname === '/sw.js') return json(404, { error: 'Offline cache disabled for fax companion.' });
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(dist, '.' + relative);
      if (!file.startsWith(dist + path.sep)) return json(403, { error: 'Invalid path.' });
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(bytes);
    } catch (error) {
      const safe = error.code === 'ENOENT' ? 'Build SignLocal first (npm run build).' : error.message;
      json(400, { error: safe });
    }
  });
  server.requestTimeout = 60000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, url: `${origin}/#fax=${token}`, origin, token };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startWeb();
  console.log(`SignLocal fax session: ${url}`);
}
