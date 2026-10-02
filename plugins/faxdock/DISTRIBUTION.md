# Fax by Adam Designs — local BYO release

MIT-licensed local plugin. Users supply and pay their own Phaxio account. Sending is disabled by default. No shared provider account, hosted fax backend, OAuth service or fax credits are supplied.

Install the marketplace archive from https://github.com/Adamdesgns/fax-by-adam-designs/releases . Extract it into a stable private local directory, add that directory with codex plugin marketplace add, then install faxdock from Adam Designs Fax Plugins. Node.js 22+ is required. Start a fresh local chat and check fax_system_status. See USER-SETUP.md for safe private provider configuration. Do not put credentials in the marketplace source or managed plugin cache.

The archive bundles locked runtime dependencies and the minimal review viewer. The full SignLocal PDF editor is optional. Local PDFs/queues are excluded. Storage is not encrypted by this application and records persist until manually removed. Default document roots are narrowly scoped. Provider transmission needs explicit configuration and immediate exact-document/recipient approval; simulation never sends.

Local synthetic package checks cover nine tools, draft/list/get/simulation/cancellation, viewer loading, private-file exclusions and locked sending. Provider transport is mock-tested; physical delivery and every desktop provider-setup flow are not verified for this release. Never auto-retry an uncertain fax. Provider receipt status does not establish legal acceptance of a filing.

This GitHub release is marketplace distribution, not approval by OpenAI's universal Plugins Directory. Standard public directory MCP submission requires remote HTTPS; local-only authors must obtain OpenAI confirmation of local MCP support. https://developers.openai.com/plugins/build/plugins

Copyright 2026 Adam Designs LLC. Project files are MIT licensed; dependencies retain their own licenses. Do not interpret this license as a provider subscription or fax charge subsidy.
