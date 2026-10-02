# Fax by Adam Designs

MIT-licensed local Codex plugin for PDF fax drafts, review and simulation. For real sending, **bring your own Phaxio account**: your computer contacts Phaxio directly and your provider bills you. No publisher fax account, credits or hosted sending service is supplied. Sending is disabled by default.

## Install the packaged release

1. Install Node.js 22 or newer.
2. Download [the marketplace ZIP](https://github.com/Adamdesgns/fax-by-adam-designs/releases/latest/download/faxdock-1.3.2-marketplace.zip) and its SHA-256 file from [Releases](https://github.com/Adamdesgns/fax-by-adam-designs/releases). It includes runtime dependencies and the minimal local viewer.
3. Extract the ZIP into a stable local directory. Run `codex plugin marketplace add <extracted-directory>` and install `faxdock@adam-designs-fax` in your supported local Codex client. A current CLI can use `codex plugin add faxdock@adam-designs-fax`.
4. Start a fresh local chat; call `fax_system_status`. Sending should be disabled. Simulation works without a fax account.

Read [private BYO provider setup](plugins/faxdock/USER-SETUP.md) before enabling transmission. It includes a credential-free [user MCP template](plugins/faxdock/user-mcp.example.toml). Never put secrets into this repository, chat, command-line arguments, or the plugin cache. The documented manual route disables the bundled MCP server, keeps the workflow skill, and registers this same runtime as a private user MCP connection. Real account setup and every desktop variant have not been verified.

## Use the source marketplace

Clone this repository, then run `npm ci --ignore-scripts` inside `plugins/faxdock`. Add the repository root using `codex plugin marketplace add <repository-directory>`, then install the plugin. To check the source locally, run `npm test` and `npm run smoke` in `plugins/faxdock`. Tests use synthetic data and mocked provider responses; smoke keeps sending disabled. Packagers are under `plugins/faxdock/scripts`.

## Safety and limitations

- Preparation/simulation is local. Sending uploads the reviewed PDF and recipient to your own configured Phaxio account and may incur charges.
- Approve the exact document hash and full recipient immediately before each send. Never automatically retry an uncertain result; inspect the provider dashboard first.
- Local records persist until removed and are not encrypted by this app. Choose narrow PDF roots and private storage outside cloud-sync folders.
- Phaxio is the only implemented provider. No inbound fax, Windows modem transport or compliance certification is offered. The bundled viewer reviews drafts; the optional separate SignLocal editor is not required.
- The release passed local synthetic archive checks. Physical fax delivery has not been verified for this packaged release. Provider transport status is not a guarantee of a filing's acceptance.

GitHub publication and marketplace installation are **not OpenAI universal-directory approval**. Standard public directory MCP submission requires remote HTTPS; local authors must confirm local MCP support with OpenAI. [Official packaging requirements](https://developers.openai.com/plugins/build/plugins).

Project code is [MIT licensed](LICENSE). Bundled dependencies retain their respective licenses. Provider account, terms and rates are your responsibility: [Phaxio pricing](https://www.phaxio.com/pricing/) and [terms](https://www.phaxio.com/terms-of-service/).
