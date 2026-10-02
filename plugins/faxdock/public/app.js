const token = new URLSearchParams(location.hash.slice(1)).get('fax');
history.replaceState(null, '', location.pathname);
const status = document.querySelector('#status');
const jobs = document.querySelector('#jobs');
async function api(route, input) {
  const response = await fetch('/api/fax/' + route, {
    method: input ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(input ? { 'Content-Type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load local drafts.');
  return result;
}
function element(tag, value) { const item = document.createElement(tag); item.textContent = value; return item; }
async function refresh() {
  if (!token) { status.textContent = 'Open the private session link returned by Codex.'; return; }
  try {
    const readiness = await api('status');
    status.textContent = readiness.realTransmissionReady ? 'Provider configured. No fax is sent by this viewer.' : readiness.blocker;
    const result = await api('jobs');
    jobs.replaceChildren();
    if (!result.jobs.length) jobs.append(element('p', 'No local drafts yet. Ask Codex to prepare your selected PDF.'));
    for (const job of result.jobs) {
      const card = element('article', '');
      card.append(element('h2', job.documentName), element('p', job.recipientName + ' · ' + job.recipientFax + ' · ' + job.status), element('code', 'PDF SHA-256: ' + job.documentSha256));
      const actions = element('div', ''); actions.className = 'actions';
      for (const [route, label, permitted] of [['simulate', 'Simulate locally', job.status === 'draft'], ['cancel', 'Cancel local draft', ['draft', 'simulated'].includes(job.status)]]) {
        if (!permitted) continue;
        const button = element('button', label);
        button.onclick = async () => { button.disabled = true; try { await api(route, { id: job.id }); await refresh(); } catch (error) { status.textContent = error.message; button.disabled = false; } };
        actions.append(button);
      }
      card.append(actions); jobs.append(card);
    }
  } catch (error) { status.textContent = error.message; }
}
document.querySelector('#refresh').onclick = refresh;
void refresh();
