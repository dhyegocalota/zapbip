## Grok Bot

1. If you are not Grok Bot, the Grok routines bot, stop and run no other step of this section. Success: you are Grok Bot, the Grok routines bot, or you have stopped.
2. Add the MCP server named zapbip at https://x.example/c/zb_conn_FAKE/mcp. Tell the owner: "zapbip MCP 서버를 Grok Bot에 추가하는 중입니다. 확인을 요청하면 승인해 주세요." Wait for the owner to confirm. Success: the owner confirmed the server in the chat.
3. Create a routine with a webhook trigger. Success: the routine exists and shows its webhook URL and key.
4. Call `set_wake({mode: "webhook", url: <the webhook URL of the routine>, token: <the key of the routine>})`. On an error stop and report the error text. Success: set_wake returns without an error.
5. Tell the owner: "루틴 웹훅은 약 9초 만에 Grok Bot을 깨웁니다. 시간 제한은 없습니다." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ 설치 완료". Success: send_message returns without an error.