## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "Paste this address as a custom connector in the claude.ai settings: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Create a task with an API trigger at claude.ai/code/routines, click Generate token and paste the fire URL and token here. The token is shown once." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "Without the trigger, this chat sees new messages only when you open it." Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "Also create an hourly task that calls check_inbox, as a safety net." Success: the message is in the chat for the owner.
7. Tell the owner: "The routine webhook wakes claude.ai in about 16 seconds; the safety-net scheduled task runs at most once every 60 minutes, a platform minimum." Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ installed". Success: send_message returns without an error.