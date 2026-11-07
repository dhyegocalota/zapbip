## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "Enable developer mode in the ChatGPT settings and add an app by the URL https://x.example/c/zb_conn_FAKE/mcp with `No authentication`." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "In one dedicated chat, create an hourly task with `Run on this computer` that calls check_inbox, and choose `Always allow` once per tool." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT is woken by a scheduled task every hour: a message can wait up to an hour." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ installed". Success: send_message returns without an error.