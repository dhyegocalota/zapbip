## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "الصق هذا العنوان موصّلًا مخصّصًا في إعدادات claude.ai: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "أنشئ مهمة بمُشغّل API من claude.ai/code/routines، واضغط Generate token، ثم الصق هنا عنوان fire URL والرمز. يظهر الرمز مرة واحدة فقط." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "من دون المُشغّل، لن ترى هذه المحادثة الرسائل الجديدة إلا عند فتحها." Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "وأنشئ أيضًا مهمة كل ساعة تستدعي check_inbox كشبكة أمان." Success: the message is in the chat for the owner.
7. Tell the owner: "يوقظ webhook الروتين claude.ai خلال نحو 16 ثانية؛ أما المهمة المجدولة الاحتياطية فتعمل مرة واحدة كل 60 دقيقة على الأكثر، وهذا حد أدنى تفرضه المنصة." Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ تم التثبيت". Success: send_message returns without an error.