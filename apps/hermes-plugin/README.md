# zapbip-platform

The [zapbip](https://zapbip.com) platform adapter for the Hermes agent. It keeps your Hermes agent listening on your WhatsApp: it holds a connection to zapbip, hands each of your messages to the agent's session, and sends the agent's replies back through the zapbip MCP server. The adapter is written in Python, so it keeps its own copy of the names it shares with the rest of the product, and a parity check pins that copy to the TypeScript it mirrors.

How to install it: [docs.zapbip.com](https://docs.zapbip.com/agents/hermes).

Licensed under the MIT License; the rest of zapbip is under the AGPL-3.0.
