## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "ChatGPTの設定で開発者モードを有効にし、URL https://x.example/c/zb_conn_FAKE/mcp でアプリを追加します。認証は`No authentication`にしてください。" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "専用のチャットで、`Run on this computer`を選んだ1時間ごとのタスクを作成し、check_inboxを呼び出すようにします。ツールごとに一度、`Always allow`を選んでください。" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPTは1時間ごとにスケジュールされたタスクで起動します。メッセージは最長1時間待つことがあります。" Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ インストール完了". Success: send_message returns without an error.