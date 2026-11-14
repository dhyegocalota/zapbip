# Applications

What zapbip runs and publishes, one folder each.

| Folder | What it is | License |
| --- | --- | --- |
| [api](api/) | The Cloudflare Worker behind zapbip: the MCP server agents connect to, one Durable Object per account, the WhatsApp Cloud API webhook and sender, the public site, the customer web app and the operator backoffice | AGPL-3.0 |
| [connector](connector/) | The local connector, published on npm as `zapbip`: it wakes your coding agent on your own machine when you text first | MIT |
| [docs](docs/) | The documentation site at [docs.zapbip.com](https://docs.zapbip.com), in every language zapbip speaks | AGPL-3.0 |
| [hermes-plugin](hermes-plugin/) | The channel plugin for the Hermes agent, a Python wheel served by zapbip | MIT |
| [openclaw-plugin](openclaw-plugin/) | The channel plugin for OpenClaw, published on npm as `@zapbip/openclaw-plugin` | MIT |

The shared rules and names these applications use live in [libs](../libs/).
