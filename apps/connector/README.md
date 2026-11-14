# zapbip

The local connector of [zapbip](https://zapbip.com), the personal WhatsApp channel for AI agents. It runs on your own machine and wakes your coding agent, such as Claude Code or Codex, when you text first on WhatsApp: your message becomes the agent's next prompt, and the agent answers you through zapbip. For a session that is already open, it relays each of your messages into that session instead.

How to install and run it, with one guide per agent: [docs.zapbip.com](https://docs.zapbip.com/developers/local-connector).

It shares its vocabulary with [the zapbip Worker](../api) through [the shared types](../../libs/types). Licensed under the MIT License; the rest of zapbip is under the AGPL-3.0.
