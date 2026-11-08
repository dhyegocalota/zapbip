## Grok Bot

1. If you are not Grok Bot, the Grok routines bot, stop and run no other step of this section. Success: you are Grok Bot, the Grok routines bot, or you have stopped.
2. Add the MCP server named zapbip at https://x.example/c/zb_conn_FAKE/mcp. Tell the owner: "I am adding the zapbip MCP server to Grok Bot. Confirm it when it asks." Wait for the owner to confirm. Success: the owner confirmed the server in the chat.
3. Create a routine with a webhook trigger. Success: the routine exists and shows its webhook URL and key.
4. Call `set_wake({mode: "webhook", url: <the webhook URL of the routine>, token: <the key of the routine>})`. On an error stop and report the error text. Success: set_wake returns without an error.
5. Tell the owner: "The routine webhook wakes Grok Bot in about 9 seconds, with no time limit." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ installed". Success: send_message returns without an error.