## Gemini CLI

1. If you are not Gemini CLI, the agent started by the `gemini` command, stop and run no other step of this section. Success: you are Gemini CLI, the agent started by the `gemini` command, or you have stopped.
2. Tell the owner: "zapbip MCP 서버를 Gemini CLI에 추가할게요. 진행해도 될까요?" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip`. Success: `gemini mcp list` no longer lists zapbip.
4. Run `gemini mcp add --transport http --scope user zapbip https://x.example/c/zb_conn_FAKE/mcp`. Success: `gemini mcp list` shows zapbip.
5. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer. Success: the background terminal is running and prints no error.
6. Tell the owner: "zapbip을 쓰려면 Gemini CLI를 다시 시작하세요." Success: the message is in the chat for the owner.
7. Tell the owner: "Gemini CLI는 백그라운드 터미널을 통해 듣고, 실행되는 동안 몇 초 안에 답해요. 시간 제한은 없어요." Success: the message is in the chat for the owner.
8. In a fresh process run `gemini -p "Call send_message with the text '✅ 설치 완료'"`. On a non-zero exit stop and show the last 20 lines of its output. Success: the command exits with zero.