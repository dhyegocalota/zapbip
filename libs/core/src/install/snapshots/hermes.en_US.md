## Hermes

1. If you are not Hermes, the agent running Hermes, stop and run no other step of this section.
2. Add the MCP server named zapbip to `config.yaml` under `mcp_servers` with `url: https://x.example/c/zb_conn_FAKE/mcp` (verify whether Hermes also needs `headers`).
3. Preferred: install and enable the zapbip platform plugin with `ZAPBIP_ALLOWED_USERS=owner` set in its environment, because the Hermes allowlist otherwise refuses the owner (verify). The plugin is the listener, with no time limit. If it works, call `set_wake({mode: "local"})` and go to the last step.
4. Only if the plugin cannot be installed, and never together with it: create a `cronjob_manage` job that runs every minute and calls `check_inbox` (verify), then call `set_wake({mode: "scheduled", interval_minutes: 1})`.
5. Tell the owner: "Checking every minute costs model calls."
6. Tell the owner: "The plugin delivers each message at once; without the plugin, Hermes checks the inbox every minute."
7. In this chat, call send_message with the text "✅ installed".