## Cursor

1. If you are not Cursor, the AI code editor and its chat panel, stop and run no other step of this section. Success: you are Cursor, the AI code editor and its chat panel, or you have stopped.
2. Tell the owner: "Voy a añadir el servidor zapbip a los ajustes MCP de Cursor. ¿Puedo?" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Add an MCP server named zapbip over HTTP at https://x.example/c/zb_conn_FAKE/mcp in the Cursor MCP settings. Success: the Cursor MCP settings list zapbip.
4. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer. Success: the background terminal is running and prints no error.
5. Tell the owner: "Reinicia el chat de Cursor para usar zapbip." Success: the message is in the chat for the owner.
6. Tell the owner: "Cursor escucha a través de la terminal en segundo plano y responde en segundos mientras se ejecuta, sin límite de tiempo." Success: the message is in the chat for the owner.
7. In this chat, call send_message with the text "✅ listo". Success: send_message returns without an error.