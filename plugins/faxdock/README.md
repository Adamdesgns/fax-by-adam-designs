# Fax by Adam Designs

Codex-first local plugin release: see [CODEX-RELEASE.md](CODEX-RELEASE.md). The repo marketplace points to this project. `npm run package` builds a self-contained local ZIP; `npm run smoke:package` checks the extracted release. Fax by Adam Designs is Adam's confirmed name. Users connect and pay their own Phaxio account; see [USER-SETUP.md](USER-SETUP.md). The standard public directory route requires remote HTTPS or OpenAI-confirmed local support. Neither local catalog wiring nor packaging is listing approval.

Local-first fax plugin for Codex, also usable as a standalone MCP server. It prepares PDF fax drafts, keeps a local metadata queue, checks configured provider readiness, and exposes explicit simulation and send tools.

## Current safety state

Real transmission is **disabled by default**. Both explicit `FAX_TRANSPORT=phaxio` selection and Phaxio credentials are required. Unsupported transport names stay disabled. A Phaxio adapter is implemented, with direct PDF upload and delivery-status lookup. No live provider call or physical fax delivery has been verified. `simulate_fax` never contacts a third party.

Codex file drafts reference the chosen local PDF. Browser drafts save the exact PDF in the private `data/documents/` folder. Job metadata persists in `data/fax-jobs.json`; recipient numbers are masked in tool responses. These records remain on disk until the owner removes them. Never commit this folder. Prefer a private local folder outside cloud-synced storage for sensitive documents by setting FAX_DATA_DIR and including that directory in FAX_ALLOWED_ROOTS.

## SignLocal and Codex setup

1. Use the bundled minimal local viewer. Build the sibling `public-pdf-signer` app only if you want its optional editor.
2. Copy `.env.example` to `.env`. Keep `FAX_TRANSPORT=disabled` for preparation/simulation. To enable provider transmission deliberately, set `FAX_TRANSPORT=phaxio` and enter your Phaxio API key and secret locally. Do not paste secrets into chat. Provider charges apply; see https://www.phaxio.com/pricing . Test credentials simulate delivery and still upload documents to the provider; use only synthetic documents in provider testing.
3. Register `node <absolute-path>/src/server.js` using `codex mcp add signlocal-fax -- node <absolute-path>/src/server.js`.
4. In a Codex session where the tools are loaded, call `open_signlocal_fax` and open its private session URL. Or run `npm run web` for a standalone session.
5. Open/edit your PDF, choose Fax PDF, enter recipient details, prepare and review the exact PDF, then approve Send fax. Preparing saves locally; sending uploads to Phaxio.
6. Check delivery and save the status receipt. Queued is not delivered. A test success is labeled test. A timeout becomes unknown: check the Phaxio dashboard using the SignLocal job tag; never automatically resend.

The local companion binds only to 127.0.0.1 on an available port. Its random session token authorizes the browser API. It rejects other origins and hostnames and does not enable CORS or a service worker. Provider keys never enter browser code. Existing public Netlify editing works without the companion, but public/mobile remote fax access is not implemented.

The adapter follows https://www.phaxio.com/docs/api/v2/faxes/create_and_send_fax and https://www.phaxio.com/docs/api/v2/faxes/get_fax . Application limit is 19 MB to leave multipart overhead under the provider's 20 MB limit. Provider page and format limits still apply. A receipt records transport delivery, not the recipient's processing or acceptance of a filing.

## Tools

- `fax_system_status`
- `prepare_fax`
- `list_faxes`
- `get_fax`
- `simulate_fax`
- `cancel_fax`
- `send_fax` (locked by default; enabling Phaxio requires explicit configuration; live delivery is unverified)
- `open_signlocal_fax` (private local app session)
- `refresh_fax` (provider receipt)

## Development

```powershell
npm test
npm run smoke
```

Claude Desktop launches `src/server.js` over stdio. Logs go to stderr because stdout is reserved for MCP JSON-RPC traffic.

## Hardware milestone

Before enabling `windows-fax`, verify all of the following:

1. A Windows-compatible USB fax modem is detected.
2. Windows Fax service and driver support are installed.
3. The telephone service is true analog POTS or explicitly supports fax/T.38.
4. One outbound and one inbound non-sensitive test fax pass.
5. Owner confirmation is required immediately before every real transmission.
