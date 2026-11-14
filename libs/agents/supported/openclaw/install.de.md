## OpenClaw

1. If you are not OpenClaw, the agent running OpenClaw, stop and run no other step of this section. Success: you are OpenClaw, the agent running OpenClaw, or you have stopped.
2. Add this entry to the OpenClaw configuration, merging it into any existing `mcp.servers`:

```json
{ "mcp": { "servers": {
  "zapbip": { "url": "https://x.example/c/zb_conn_FAKE/mcp", "transport": "streamable-http" }
} } }
```

If the URL form is refused, use the same host with `/mcp` and the header `Authorization: Bearer <the secret after /c/ in that URL>`. Success: `mcp.servers` holds the zapbip entry.
3. Preferred: Tell the owner: "Das zapbip-Plugin liest deine Nachrichten für diesen Agenten aus zapbip und sendet die Antworten des Agenten zurück. Mehr tut es nicht. Darf ich es installieren?" Wait for the owner to answer before the next step. If the owner says no, skip to the next step. If yes, run `openclaw plugins install @zapbip/openclaw-plugin@0.1.0 --force --accept-capabilities` and set `channels.zapbip.connectionLink` to https://x.example/c/zb_conn_FAKE/mcp. The plugin is the listener, with no time limit. If it works, call `set_wake({mode: "local"})` and go to the last step. Success: the install command exits with zero and set_wake returns without an error, or the owner said no.
4. Only if the plugin cannot be installed, and never together with it: with the automations tool create a job that runs every minute (`every 1m`) and calls `check_inbox`, then call `set_wake({mode: "scheduled", interval_minutes: 1})`. Success: the automations tool lists the job and set_wake returns without an error.
5. Tell the owner: "Die Prüfung jede Minute verursacht Modellaufrufe." Success: the message is in the chat for the owner.
6. Tell the owner: "Das Plugin liefert jede Nachricht sofort; ohne das Plugin prüft OpenClaw den Posteingang jede Minute." Success: the message is in the chat for the owner.
7. In this chat, call send_message with the text "✅ installiert". Success: send_message returns without an error.