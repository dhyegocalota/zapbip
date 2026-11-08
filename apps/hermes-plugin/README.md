# zapbip-platform

The zapbip platform adapter for Hermes. It keeps the agent listening on the owner's WhatsApp: it holds a connection to zapbip, hands each owner message to the agent's session, and sends the agent's replies back through the zapbip MCP server. The adapter is written in Python, so it keeps its own copy of the names it shares with the rest of the product, and a parity check pins that copy to the TypeScript it mirrors.
