## Grok web

1. If you are not Grok web, the chat in the Grok web app, stop and run no other step of this section. Success: you are Grok web, the chat in the Grok web app, or you have stopped.
2. Tell the owner: "在 Grok 设置中，把这个地址粘贴为连接器：https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Call `set_wake({mode: "standby", standby_agent: "Ana Bot"})`. Success: set_wake returns without an error.
4. Tell the owner: "网页版 Grok 无法从外部唤醒：所选的备用智能体会在几秒内代它回应。" Success: the message is in the chat for the owner.
5. In this chat, call send_message with the text "✅ 安装完成". Success: send_message returns without an error.