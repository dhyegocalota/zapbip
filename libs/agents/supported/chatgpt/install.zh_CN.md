## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "在 ChatGPT 设置中开启开发者模式，用网址 https://x.example/c/zb_conn_FAKE/mcp 添加一个应用，认证选 `No authentication`。" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "在一个专用的聊天里创建一个每小时运行的任务，选 `Run on this computer`，让它调用 check_inbox，并对每个工具选一次 `Always allow`。" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT 每小时由一个计划任务唤醒：一条消息最多可能要等一个小时。" Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ 安装完成". Success: send_message returns without an error.