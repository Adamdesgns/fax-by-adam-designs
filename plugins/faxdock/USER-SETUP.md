# Connect your own fax account

Fax by Adam Designs runs locally. Each user supplies their own Phaxio account and pays Phaxio directly; Adam provides no shared credentials, fax credits or paid hosted fax service. Simulation needs no account and contacts no provider. Phaxio is the only implemented provider; Sinch and arbitrary fax providers are not supported. A live provider/physical delivery test has not been verified.

## Install and try locally

Install Node.js 22 or newer. Extract the sanitized marketplace ZIP into a stable directory. Add that directory with codex plugin marketplace add <extracted-marketplace-directory>, then install faxdock from Adam Designs Fax Plugins using your supported local client. Start a fresh chat and call fax_system_status: sending should be disabled. Keep the bundled configuration unchanged for simulation. The minimal local viewer is included; building the sibling SignLocal app is optional.

The default allowed document directory is the host's private PLUGIN_DATA directory. To choose ordinary PDF folders you must explicitly configure selected roots; do not allow a whole drive. Draft records persist until you remove them and this application does not encrypt local storage. Keep private data outside cloud-sync directories and plugin source/cache folders.

## Connect Phaxio privately

Plugin user configuration can switch a bundled MCP server on/off and set tool policy; official docs do not document a per-user transport/environment override for it. Do not edit the managed plugin cache or put a credential-bearing .env into marketplace source: refresh could overwrite it or distribute secrets.

The supported local configuration route is to disable only this plugin's bundled MCP server, retain its workflow skill, and register the same extracted runtime as a user-configured stdio MCP server. The included user-mcp.example.toml shows this arrangement, with all credentials absent and transmission still disabled. Replace paths and marketplace ID locally. Confirm no duplicate fax runtime is enabled before continuing. This manual provider setup has not been exercised with real credentials or every desktop client.

Use a trusted local secret manager or your own launch process to make PHAXIO_API_KEY and PHAXIO_API_SECRET available to Codex. The example forwards those variable names, not their values. Never paste keys into chat, provider command-line arguments, a project config, public repo or browser. Ordinary environment variables and .env files are not an encrypted credential vault. No OAuth account or publisher login is needed for this local runtime.

After reviewing your own provider's terms/rates, change only your private user connection's FAX_TRANSPORT from disabled to phaxio. Call fax_system_status; readiness checks configuration only and never verifies provider identity, balance or delivery. Preparing a draft, installing the package or enabling transport is not consent to send. Approve the exact PDF hash and full recipient number immediately before each send, understanding the PDF/number goes directly to Phaxio and your account may be charged. Never retry an uncertain result automatically. Inspect your provider dashboard first. A test credential still uploads a document to Phaxio; use synthetic documents only for testing.

## Costs and platform scope

There is no Adam-funded fax account or hosted runtime in this release. Users pay their provider and need a compatible local Codex/ChatGPT desktop surface, Node, and any applicable OpenAI subscription. The plugin source is MIT licensed. Bundled third-party dependencies retain their respective licenses.

Phaxio rates/terms: https://www.phaxio.com/pricing/ and https://www.phaxio.com/terms-of-service/ . Codex MCP user configuration: https://learn.chatgpt.com/docs/extend/mcp?surface=cli . Repo marketplaces are separate from the universal public directory: https://developers.openai.com/plugins/build/plugins .
