# zapbip-platform

The zapbip platform adapter for Hermes. It keeps the agent listening on the owner's WhatsApp: it holds a connection to zapbip, hands each owner message to the agent's session, and sends the agent's replies back through the zapbip MCP server. It shares its names with the rest of the product through [the shared types](../../libs/types).
