## OpenClaw

1. If you are not OpenClaw, the agent running OpenClaw, stop and run no other step of this section.
2. Add `mcp.servers.zapbip` with `transport: "streamable-http"` and the URL https://x.example/c/zb_conn_FAKE/mcp (verify whether OpenClaw also needs the Bearer header).
3. Preferred: install the zapbip channel plugin (verify). If it works, call `set_wake({mode: "local"})` and go to the last step.
4. Fallback: with the automations tool create a `stream` job that keeps `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` running (verify), or a job that runs every minute (`every 1m`) and calls `check_inbox` (verify).
5. Call `set_wake({mode: "scheduled", interval_minutes: 1})`.
6. Tell the owner: "Verificar a cada minuto gasta chamadas do modelo."
7. In this chat, call send_message with the text "✅ instalado".