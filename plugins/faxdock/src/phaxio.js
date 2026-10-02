// Credentials stay in this Node process, never the browser or MCP responses.
export class Phaxio {
  constructor({ key, secret, fetcher = fetch } = {}) {
    this.key = key; this.secret = secret; this.fetcher = fetcher;
  }
  get ready() { return Boolean(this.key && this.secret); }
  async request(route, body) {
    if (!this.ready) throw new Error('Connect Phaxio credentials locally first.');
    const response = await this.fetcher(`https://api.phaxio.com/v2/${route}`, {
      method: body ? 'POST' : 'GET', body,
      headers: { Authorization: `Basic ${Buffer.from(`${this.key}:${this.secret}`).toString('base64')}` },
      redirect: 'error', signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('Provider request failed. Check the provider dashboard before trying again.');
    return result.data;
  }
  async send(job, bytes) {
    const body = new FormData();
    body.set('to', job.recipientFax);
    body.set('file', new Blob([bytes], { type: 'application/pdf' }), 'document.pdf');
    body.set('tag[signlocal_job]', job.id);
    const data = await this.request('faxes', body);
    if (!Number.isSafeInteger(data?.id) || data.id <= 0) throw new Error('Provider returned no valid receipt.');
    return String(data.id);
  }
  async status(id) {
    if (!/^\d+$/.test(String(id))) throw new Error('Invalid provider receipt.');
    const data = await this.request(`faxes/${id}`);
    return { providerStatus: data.status, isTest: data.is_test === true,
      status: data.is_test === true ? 'test' : ({ success: 'delivered', failure: 'failed' }[data.status] || 'queued'),
      pages: data.num_pages, costCents: data.cost, completedAt: data.completed_at };
  }
}
