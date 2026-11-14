## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "在 claude.ai 设置中，把这个地址粘贴为自定义连接器：https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "在 claude.ai/code/routines 创建一个带 API 触发器的任务，点击 Generate token，然后把 fire URL 和令牌粘贴到这里。令牌只显示一次。" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "没有触发器的话，只有你打开这个聊天时，它才能看到新消息。" Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "另外再创建一个每小时调用 check_inbox 的任务，作为保险。" Success: the message is in the chat for the owner.
7. Tell the owner: "例行任务的 Webhook 大约 16 秒就能唤醒 claude.ai；作为保险的计划任务最多每 60 分钟运行一次，这是平台的最低间隔。" Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ 安装完成". Success: send_message returns without an error.