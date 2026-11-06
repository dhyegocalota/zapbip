# zapbip

The command an owner runs on their own machine to wake a local Claude Code or Codex session when a WhatsApp message arrives. It keeps one channel to [the Worker](../api) open for a connection, resumes the session with the owner's message as the prompt, and lets the agent answer only through `send_message`. For a session that is already open it also relays each owner message as a Claude Code channel notification or as one line of output a background watcher can react to. It shares its vocabulary with the Worker through [the shared types](../../libs/types).
