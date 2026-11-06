## Cursor

1. If you are not Cursor, the AI code editor and its chat panel, stop and run no other step of this section.
2. Add an MCP server named zapbip over HTTP at https://x.example/c/zb_conn_FAKE/mcp in the Cursor MCP settings. Tell the owner: "I added the zapbip server to the Cursor MCP settings. Confirm it when Cursor asks." Wait for the owner to answer before the next step.
3. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen`. Watch it with Monitor and re-arm it on each timeout notice (a watch lasts at most 30 minutes).
4. Call `set_wake({mode: "local"})`.
5. Tell the owner: "Restart the Cursor chat to use zapbip."
6. In this chat, call send_message with the text "✅ installed".