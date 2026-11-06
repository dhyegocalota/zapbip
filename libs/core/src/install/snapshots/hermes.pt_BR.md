## Hermes

1. If you are not Hermes, the agent running Hermes, stop and run no other step of this section.
2. Add the MCP server named zapbip to `config.yaml` under `mcp_servers` with `url: https://x.example/c/zb_conn_FAKE/mcp` (verify whether Hermes also needs `headers`).
3. Preferred: install and enable the zapbip platform plugin (verify). If it works, call `set_wake({mode: "local"})` and go to the last step.
4. Fallback: start `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` with `terminal(background=true, watch_patterns=…)` (verify), or create a `cronjob_manage` job that runs every minute and calls `check_inbox` (verify).
5. Call `set_wake({mode: "scheduled", interval_minutes: 1})`.
6. Tell the owner: "Verificar a cada minuto gasta chamadas do modelo."
7. In this chat, call send_message with the text "✅ instalado".