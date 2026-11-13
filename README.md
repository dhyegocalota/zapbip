# zapbip

**Your AI agents text you on WhatsApp.** They ask with buttons, wait for your tap, then keep working.

zapbip is a personal WhatsApp channel for AI agents. Connect Claude Code, Codex, Cursor, Gemini CLI or any MCP client to your own phone through one MCP server: agents send you messages, ask questions with buttons or lists and block until you answer, exchange files and voice notes, and wake up when you text first. Several agents share one chat, and each reply goes back to the agent that asked.

It uses only Meta's official WhatsApp Cloud API, it talks only to you, and it deletes each message after a fixed time.

- Hosted: [zapbip.com](https://zapbip.com) (early access, waitlist open)
- Docs: [docs.zapbip.com](https://docs.zapbip.com)
- Made by [Logic Bit](https://logicbit.com.br) in Belo Horizonte, Brazil

## How it works

```
your agent ──MCP──▶ zapbip (Cloudflare Worker) ──WhatsApp Cloud API──▶ your phone
     ▲                    │  one Durable Object per account               │
     └──── your answer ◀──┴── routed to the agent that asked ◀── you tap ─┘
```

- **MCP server.** One endpoint and one key per agent. The tools send a message, ask with buttons or a list and wait, send and receive media, and check the inbox.
- **Account inbox.** A Durable Object per account holds the queue, the open questions and the routing, so a reply reaches the agent that asked even when several agents share the chat.
- **Wake.** When you text first, the local connector resumes your coding agent's session in seconds; hosted agents pick the message up at their next check.
- **WhatsApp.** Meta's official Cloud API only, through numbers the operator registers; outside the 24-hour window, approved utility templates reach you.

## Repository

| Path                                                                                    | What it holds                                                                                                                       |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [apps/api](apps/api/)                                                                   | The Cloudflare Worker: MCP server, Durable Objects, D1 directory, R2 media, the public site, the customer web app and the backoffice |
| [apps/connector](apps/connector/)                                                       | The local connector that wakes a coding agent when you text first                                                                   |
| [apps/openclaw-plugin](apps/openclaw-plugin/), [apps/hermes-plugin](apps/hermes-plugin/) | Channel plugins for agent runtimes                                                                                                  |
| [apps/docs](apps/docs/)                                                                 | The documentation site, in English and Portuguese                                                                                   |
| [libs/core](libs/core/)                                                                 | The inbox, routing and delivery rules as plain TypeScript                                                                           |
| [libs/agents](libs/agents/)                                                             | The registry of supported agents and their install guides                                                                           |
| [libs/types](libs/types/)                                                               | Shared enums and constants                                                                                                          |
| [tools/repository-shape](tools/repository-shape/)                                       | Tests about the repository itself                                                                                                   |
| [docs](docs/)                                                                           | Decisions, learnings, features, scenarios and runbooks                                                                              |

## Run it locally

[docs/contributing/local-stack.md](docs/contributing/local-stack.md) starts the Worker with a test double for WhatsApp and walks an agent through a full conversation, with no Meta account needed.

## Self-hosting

zapbip runs on Cloudflare (Workers, Durable Objects, D1, R2) and a Meta app with the WhatsApp Cloud API. The [runbooks](docs/runbooks/) are the exact path the hosted service follows, from zero accounts to go-live. To run your own copy, follow them with your own accounts and replace the hosted service's identifiers: the routes and resource ids in `apps/api/wrangler.jsonc`, the zone and the Meta app constants in `libs/types`, and the company facts the legal pages use. First-class configuration for self-hosting is not there yet; issues and pull requests that move it there are welcome.

## Built with agents

Most of this repository was written by AI coding agents working under a harness: a written process from agreement to merge, red-first tests, a reviewer and a security reviewer before every pull request, and tests about the repository's own shape. Read [.claude/HARNESS.md](.claude/HARNESS.md) for the process, [AGENTS.md](AGENTS.md) for the conventions, [docs/adr](docs/adr/) for the decisions and [docs/learnings](docs/learnings/) for the traps.

## Contributing

Read [CONTRIBUTING](.github/CONTRIBUTING.md). Report vulnerabilities privately as [SECURITY](.github/SECURITY.md) explains, never in a public issue. Everyone follows the [code of conduct](.github/CODE_OF_CONDUCT.md).

## License

The server, the site and the libraries are licensed under the [GNU Affero General Public License v3.0](LICENSE). The client packages that run on your machine or inside your agent runtime, [apps/connector](apps/connector/LICENSE), [apps/openclaw-plugin](apps/openclaw-plugin/LICENSE) and [apps/hermes-plugin](apps/hermes-plugin/LICENSE), are licensed under the MIT License.

WhatsApp is a trademark of Meta. Agent names are trademarks of their owners. The zapbip name and logo belong to Logic Bit.
