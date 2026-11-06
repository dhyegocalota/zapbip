## Cursor

1. If you are not Cursor, the AI code editor and its chat panel, stop and run no other step of this section.
2. Tell the owner: "Vou adicionar o servidor zapbip às configurações de MCP do Cursor. Posso?" Wait for the owner to answer before the next step. If the owner does not say yes, stop.
3. Add an MCP server named zapbip over HTTP at https://x.example/c/zb_conn_FAKE/mcp in the Cursor MCP settings.
4. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer.
5. Tell the owner: "Reinicie o chat do Cursor para usar o zapbip."
6. Tell the owner: "O Cursor escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo."
7. In this chat, call send_message with the text "✅ instalado".