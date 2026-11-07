# zapbip-platform

The zapbip platform adapter for Hermes. It keeps the agent listening on the owner's WhatsApp: it holds a connection to zapbip, hands each owner message to the agent's session, and sends the agent's replies back through the zapbip MCP server. It shares its names with the rest of the product through [the shared types](../../libs/types).

## Install

```bash
pip install "zapbip-platform @ https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-py3-none-any.whl#sha256=25e9eade35908bffc09ed502cde3f41bc4eb59ac6f7befefe4a8c0aba0b30ee1"
```
