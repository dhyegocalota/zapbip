## OpenClaw

1. If you are not OpenClaw, the agent running OpenClaw, stop and run no other step of this section.
2. Add `mcp.servers.zapbip` with `transport: "streamable-http"` and the URL https://x.example/c/zb_conn_FAKE/mcp.
3. Preferred: run `openclaw plugins install @zapbip/openclaw-plugin@0.1.0` and set `channels.zapbip.connectionLink` to https://x.example/c/zb_conn_FAKE/mcp. The plugin is the listener, with no time limit. If it works, call `set_wake({mode: "local"})` and go to the last step.
4. Only if the plugin cannot be installed, and never together with it: with the automations tool create a job that runs every minute (`every 1m`) and calls `check_inbox`, then call `set_wake({mode: "scheduled", interval_minutes: 1})`.
5. Tell the owner: "Verificar a cada minuto gasta chamadas do modelo."
6. Tell the owner: "O plugin entrega cada mensagem na hora; sem o plugin, o OpenClaw verifica a caixa de entrada a cada minuto."
7. In this chat, call send_message with the text "✅ instalado".