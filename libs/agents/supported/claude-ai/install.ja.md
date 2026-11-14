## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "claude.aiの設定で、このアドレスをカスタムコネクタとして貼り付けてください: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "claude.ai/code/routinesでAPIトリガー付きのタスクを作成し、Generate tokenをクリックして、fire URLとトークンをここに貼り付けてください。トークンは一度しか表示されません。" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "トリガーがない場合、このチャットは、あなたが開いたときにだけ新しいメッセージを見られます。" Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "保険として、check_inboxを呼び出す1時間ごとのタスクも作成してください。" Success: the message is in the chat for the owner.
7. Tell the owner: "ルーティンのWebhookは約16秒でclaude.aiを起動します。保険のスケジュールタスクは、プラットフォームの下限である60分に1回までしか実行されません。" Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ インストール完了". Success: send_message returns without an error.