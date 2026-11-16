## Codex

1. If you are not Codex, the agent started by the `codex` command, stop and run no other step of this section. Success: you are Codex, the agent started by the `codex` command, or you have stopped.
2. Tell the owner: "سأكتب خادم zapbip في ~/.codex/config.toml. هذا يتيح لأدوات zapbip العمل دون إشراف، من دون طلب موافقة عند كل استخدام. هل أستطيع ذلك؟" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Remove any existing [mcp_servers.zapbip] table from ~/.codex/config.toml, then append this table, so the file never holds a second one:

```toml
[mcp_servers.zapbip]
url = "https://x.example/c/zb_conn_FAKE/mcp"
tool_timeout_sec = 900
default_tools_approval_mode = "approve"
```
Success: ~/.codex/config.toml holds exactly one [mcp_servers.zapbip] table with that content.
4. In the background run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.2.0 connect --client codex`. It keeps listening and resumes the session with `codex exec resume`. Success: the connector is running in the background and prints no error.
5. Tell the owner: "أعد تشغيل Codex لاستخدام zapbip." Success: the message is in the chat for the owner.
6. Tell the owner: "يستأنف الموصّل جلسة Codex مع كل رسالة، خلال نحو 6 ثوانٍ ودون حد زمني." Success: the message is in the chat for the owner.
7. In a fresh process run `codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"' "Call send_message with the text '✅ تم التثبيت'"`. On a non-zero exit stop and show the last 20 lines of its output. Success: the command exits with zero.