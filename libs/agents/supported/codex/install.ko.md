## Codex

1. If you are not Codex, the agent started by the `codex` command, stop and run no other step of this section. Success: you are Codex, the agent started by the `codex` command, or you have stopped.
2. Tell the owner: "zapbip 서버를 ~/.codex/config.toml에 작성할게요. 그러면 zapbip 도구가 사용할 때마다 승인을 묻지 않고 무인으로 실행돼요. 진행해도 될까요?" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Remove any existing [mcp_servers.zapbip] table from ~/.codex/config.toml, then append this table, so the file never holds a second one:

```toml
[mcp_servers.zapbip]
url = "https://x.example/c/zb_conn_FAKE/mcp"
tool_timeout_sec = 900
default_tools_approval_mode = "approve"
```
Success: ~/.codex/config.toml holds exactly one [mcp_servers.zapbip] table with that content.
4. In the background run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.2.0 connect --client codex`. It keeps listening and resumes the session with `codex exec resume`. Success: the connector is running in the background and prints no error.
5. Tell the owner: "zapbip을 쓰려면 Codex를 다시 시작하세요." Success: the message is in the chat for the owner.
6. Tell the owner: "커넥터가 메시지마다 약 6초 만에 Codex 세션을 재개해요. 시간 제한은 없어요." Success: the message is in the chat for the owner.
7. In a fresh process run `codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"' "Call send_message with the text '✅ 설치 완료'"`. On a non-zero exit stop and show the last 20 lines of its output. Success: the command exits with zero.