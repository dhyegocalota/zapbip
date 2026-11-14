## Gemini CLI

1. If you are not Gemini CLI, the agent started by the `gemini` command, stop and run no other step of this section. Success: you are Gemini CLI, the agent started by the `gemini` command, or you have stopped.
2. Tell the owner: "zapbipのMCPサーバーをGemini CLIに追加します。よろしいですか？" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip`. Success: `gemini mcp list` no longer lists zapbip.
4. Run `gemini mcp add --transport http --scope user zapbip https://x.example/c/zb_conn_FAKE/mcp`. Success: `gemini mcp list` shows zapbip.
5. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer. Success: the background terminal is running and prints no error.
6. Tell the owner: "zapbipを使うには、Gemini CLIを再起動してください。" Success: the message is in the chat for the owner.
7. Tell the owner: "Gemini CLIはバックグラウンドのターミナルを通じて待ち受け、実行中は数秒で応答します。時間制限はありません。" Success: the message is in the chat for the owner.
8. In a fresh process run `gemini -p "Call send_message with the text '✅ インストール完了'"`. On a non-zero exit stop and show the last 20 lines of its output. Success: the command exits with zero.