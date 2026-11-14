## Hermes

1. If you are not Hermes, the agent running Hermes, stop and run no other step of this section. Success: you are Hermes, the agent running Hermes, or you have stopped.
2. Add the MCP server named zapbip to `config.yaml`, merging this entry into any existing `mcp_servers`:

```yaml
mcp_servers:
  zapbip:
    url: https://x.example/c/zb_conn_FAKE/mcp
```
Success: `config.yaml` holds the zapbip entry under `mcp_servers`.
3. Preferred: run `d=$(mktemp -d) && curl -fsSL https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-requirements.txt -o "$d/zapbip-requirements.txt" && python3 -c 'import hashlib,sys; sys.exit(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest() != sys.argv[2])' "$d/zapbip-requirements.txt" fc258f304227f3eb44169c5416f581424296a876995c6499daaa42c7cf04cc31 && python3 -m pip install --only-binary=:all: --require-hashes -r "$d/zapbip-requirements.txt"` so it is importable by Hermes (Hermes then enables the platform by itself), and set `ZAPBIP_CONNECTION_LINK=https://x.example/c/zb_conn_FAKE/mcp` and `ZAPBIP_ALLOWED_USERS=owner` in the Hermes environment, because the Hermes allowlist otherwise refuses the owner. The plugin is the listener, with no time limit. If it works, call `set_wake({mode: "local"})` and go to the last step. Success: the install command exits with zero and set_wake returns without an error.
4. Only if the plugin cannot be installed, and never together with it: create a `cronjob_manage` job that runs every minute and calls `check_inbox`, then call `set_wake({mode: "scheduled", interval_minutes: 1})`. Success: the job is listed by `cronjob_manage` and set_wake returns without an error.
5. Tell the owner: "1分ごとの確認は、モデルの呼び出しを消費します。" Success: the message is in the chat for the owner.
6. Tell the owner: "プラグインはメッセージを即座に配信します。プラグインがない場合、Hermesは1分ごとに受信箱を確認します。" Success: the message is in the chat for the owner.
7. In this chat, call send_message with the text "✅ インストール完了". Success: send_message returns without an error.