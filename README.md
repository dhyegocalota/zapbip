<p align="center">
  <a href="https://zapbip.com"><img src="https://zapbip.com/favicon.svg" alt="zapbip" width="96" height="96"></a>
</p>

<h1 align="center">zapbip</h1>

<p align="center">
  <strong>Your AI agents text you on WhatsApp.</strong><br>
  They ask with buttons, wait for your tap, then keep working.
</p>

<p align="center">

[![license](https://img.shields.io/github/license/dhyegocalota/zapbip?color=128C7E)](LICENSE)
[![stars](https://img.shields.io/github/stars/dhyegocalota/zapbip?style=flat&color=128C7E)](https://github.com/dhyegocalota/zapbip/stargazers)
[![docs](https://img.shields.io/badge/docs-docs.zapbip.com-128C7E)](https://docs.zapbip.com)
[![website](https://img.shields.io/badge/website-zapbip.com-128C7E)](https://zapbip.com)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-128C7E)](.github/CONTRIBUTING.md)

</p>

<p align="center">
  <a href="https://zapbip.com">Website</a> ·
  <a href="https://docs.zapbip.com">Docs</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="https://github.com/dhyegocalota/zapbip/issues">Issues</a>
</p>

---

zapbip is a personal WhatsApp channel for AI agents. Connect Claude Code, Codex, Cursor, Gemini CLI or any MCP client to your own phone through one MCP server: agents send you messages, ask questions with buttons or lists and block until you answer, exchange files and voice notes, and wake up when you text first. Several agents share one chat, and each reply goes back to the agent that asked.

It uses only Meta's official WhatsApp Cloud API, it talks only to you, and it deletes each message after a fixed time.

zapbip is a product of Logic Bit, made in Belo Horizonte, Brazil: [logicbit.com.br](https://logicbit.com.br)

## ✨ Features

- 💬 **Messages that reach you.** An agent texts you when it finishes, fails or needs you.
- 🔘 **Questions with buttons and lists.** The agent blocks until you tap, then keeps working.
- 📎 **Files and voice notes** in both directions.
- 🔔 **Wake on text.** Message first and your coding agent's session resumes in seconds.
- 👥 **Many agents, one chat.** Each reply is routed back to the agent that asked.
- 🔒 **Yours alone.** Official Cloud API only, one owner per account, every message deleted after a fixed time.
- 🧩 **Any MCP client.** One server, one key per agent, set up in minutes.

## 🚀 Quick start

1. **Message zapbip on WhatsApp.** Open the start link at [zapbip.com](https://zapbip.com) and send any message. It creates your account on the waitlist, and zapbip tells you in that chat when your access opens.
2. **Ask for an agent.** Once you are in, send `new agent claude`. zapbip answers with one line made for you.
3. **Paste it into your AI.** Your agent reads the instructions online, connects itself and texts you a first message.

The full walk-through, with one guide per agent, is at [docs.zapbip.com](https://docs.zapbip.com).

## 🧠 How it works

```
your agent ──MCP──▶ zapbip (Cloudflare Worker) ──WhatsApp Cloud API──▶ your phone
     ▲                    │  one Durable Object per account               │
     └──── your answer ◀──┴── routed to the agent that asked ◀── you tap ─┘
```

- **MCP server.** One endpoint and one key per agent. The tools send a message, ask with buttons or a list and wait, send and receive media, and check the inbox.
- **Account inbox.** A Durable Object per account holds the queue, the open questions and the routing, so a reply reaches the agent that asked even when several agents share the chat.
- **Wake.** When you text first, the local connector resumes your coding agent's session in seconds; hosted agents pick the message up at their next check.
- **WhatsApp.** Meta's official Cloud API only, through numbers the operator connects with Meta's onboarding; outside the 24-hour window, approved utility templates reach you.

## 🤖 Supported agents

Coding agents, chat apps and any MCP client connect the same way. [The supported agents](https://docs.zapbip.com/agents/supported-agents) page lists each one with its install guide.

## 🗂️ Repository

| Path | What it holds |
| --- | --- |
| [apps/api](apps/api/) | The Cloudflare Worker: MCP server, Durable Objects, D1 directory, R2 media, the public site, the customer web app and the backoffice |
| [apps/connector](apps/connector/) | The local connector that wakes a coding agent when you text first |
| [apps/hermes-plugin](apps/hermes-plugin/) | The channel plugin for Hermes |
| [apps/openclaw-plugin](apps/openclaw-plugin/) | The channel plugin for OpenClaw |
| [apps/docs](apps/docs/) | The documentation site, in every language zapbip speaks |
| [libs/core](libs/core/) | The inbox, routing and delivery rules as plain TypeScript |
| [libs/agents](libs/agents/) | The registry of supported agents and their install guides |
| [libs/types](libs/types/) | Shared enums and constants |
| [tools/repository-shape](tools/repository-shape/) | Tests about the repository itself |
| [docs](docs/) | Decisions, learnings, features, scenarios and runbooks |

## 🧪 Run it locally

[docs/contributing/local-stack.md](docs/contributing/local-stack.md) starts the Worker with a test double for WhatsApp and walks an agent through a full conversation, with no Meta account needed.

## 🏠 Self-hosting

zapbip runs on Cloudflare (Workers, Durable Objects, D1, R2) and a Meta app with the WhatsApp Cloud API. The [runbooks](docs/runbooks/) are the exact path the hosted service follows, from zero accounts to go-live. To run your own copy, follow them with your own accounts and replace the hosted service's identifiers: the routes and resource ids in `apps/api/wrangler.jsonc`, the zone and the Meta app constants in `libs/types`, and the company facts the legal pages use. First-class configuration for self-hosting is not there yet; issues and pull requests that move it there are welcome.

## 🛠️ Built with agents

Most of this repository was written by AI coding agents working under a harness: a written process from agreement to merge, red-first tests, a reviewer and a security reviewer before every pull request, and tests about the repository's own shape. Read [.claude/HARNESS.md](.claude/HARNESS.md) for the process, [AGENTS.md](AGENTS.md) for the conventions, [docs/adr](docs/adr/) for the decisions and [docs/learnings](docs/learnings/) for the traps.

## 🗺️ Roadmap

What ships and what is next lives in [docs/features](docs/features/): one folder per feature with its spec, plan and test plan, and a status table in its index. The decisions behind the design are the [ADRs](docs/adr/).

## 💬 Community

- 🐛 Found a bug or want a feature? [Open an issue](https://github.com/dhyegocalota/zapbip/issues/new/choose).
- 📖 Questions about setup? Start with the [docs](https://docs.zapbip.com).
- 🔐 Found a vulnerability? Report it privately as [SECURITY](.github/SECURITY.md) explains, never in a public issue.
- 🤝 Want to contribute? Read [CONTRIBUTING](.github/CONTRIBUTING.md) and agree to the [Contributor License Agreement](.github/CLA.md). Everyone follows the [code of conduct](.github/CODE_OF_CONDUCT.md).

## 👥 Contributors

<a href="https://github.com/dhyegocalota/zapbip/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=dhyegocalota/zapbip" alt="Contributors">
</a>

## ⭐ Star history

<a href="https://star-history.com/#dhyegocalota/zapbip&Date">
  <img src="https://api.star-history.com/svg?repos=dhyegocalota/zapbip&type=Date" alt="Star history chart">
</a>

## 📄 License

Copyright © 2026 Logic Bit AI Software Boutique Ltda.

The server, the site and the libraries are licensed under the [GNU Affero General Public License v3.0](LICENSE). The client packages that run on your machine or inside your agent runtime, the [local connector](apps/connector/LICENSE) and the `apps/*-plugin` channel plugins, are licensed under the MIT License; each carries its own `LICENSE` file.

WhatsApp is a trademark of Meta. Agent names are trademarks of their owners. The zapbip name and logo belong to Logic Bit.
