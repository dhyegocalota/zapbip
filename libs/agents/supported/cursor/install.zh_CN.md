## Cursor

1. If you are not Cursor, the AI code editor and its chat panel, stop and run no other step of this section. Success: you are Cursor, the AI code editor and its chat panel, or you have stopped.
2. Tell the owner: "我将把 zapbip 服务器添加到 Cursor 的 MCP 设置中。可以吗？" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Add an MCP server named zapbip over HTTP at https://x.example/c/zb_conn_FAKE/mcp in the Cursor MCP settings. Success: the Cursor MCP settings list zapbip.
4. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer. Success: the background terminal is running and prints no error.
5. Tell the owner: "请重新启动 Cursor 聊天以使用 zapbip。" Success: the message is in the chat for the owner.
6. Tell the owner: "Cursor 通过后台终端监听，运行期间几秒内就会回应，不限时。" Success: the message is in the chat for the owner.
7. In this chat, call send_message with the text "✅ 安装完成". Success: send_message returns without an error.