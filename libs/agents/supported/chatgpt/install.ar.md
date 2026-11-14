## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "فعّل وضع المطوّر في إعدادات ChatGPT وأضف تطبيقًا عبر العنوان https://x.example/c/zb_conn_FAKE/mcp مع الخيار `No authentication`." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "في محادثة مخصّصة واحدة، أنشئ مهمة كل ساعة بالخيار `Run on this computer` تستدعي check_inbox، واختر `Always allow` مرة واحدة لكل أداة." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "يوقظ ChatGPT مهمة مجدولة كل ساعة: قد تنتظر الرسالة حتى ساعة كاملة." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ تم التثبيت". Success: send_message returns without an error.