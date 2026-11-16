## Cursor

1. If you are not Cursor, the AI code editor and its chat panel, stop and run no other step of this section. Success: you are Cursor, the AI code editor and its chat panel, or you have stopped.
2. Tell the owner: "I will add the zapbip server to the Cursor MCP settings. May I?" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Add an MCP server named zapbip over HTTP at https://x.example/c/zb_conn_FAKE/mcp in the Cursor MCP settings. Success: the Cursor MCP settings list zapbip.
4. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.2.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer. Success: the background terminal is running and prints no error.
5. Tell the owner: "Restart the Cursor chat to use zapbip." Success: the message is in the chat for the owner.
6. Tell the owner: "Cursor listens through the background terminal and answers within seconds while it runs, with no time limit." Success: the message is in the chat for the owner.
7. In this chat, call send_message with the text "✅ installed". Success: send_message returns without an error.