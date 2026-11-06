# zapbip

The command an owner runs on their own machine to wake a local Claude Code or Codex session when a WhatsApp message arrives. It keeps one channel to [the Worker](../api) open for a connection, resumes the session with the owner's message as the prompt, and lets the agent answer only through `send_message`. It shares its vocabulary with the Worker through [the shared types](../../libs/types).
