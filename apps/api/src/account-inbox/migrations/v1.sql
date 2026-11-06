CREATE TABLE inbox_messages (
  id TEXT PRIMARY KEY,
  agent TEXT,
  direction TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  reply_to TEXT,
  delivery TEXT,
  read_at INTEGER,
  at INTEGER NOT NULL
);

CREATE INDEX inbox_messages_agent_at ON inbox_messages (agent, at);
CREATE INDEX inbox_messages_delivery ON inbox_messages (delivery);
CREATE INDEX inbox_messages_direction_at ON inbox_messages (direction, at);

CREATE TABLE questions (
  question_id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  text TEXT NOT NULL,
  options TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  prompt_message_id TEXT NOT NULL,
  asked_at INTEGER NOT NULL,
  answer TEXT
);

CREATE INDEX questions_agent_key ON questions (agent, normalized_key, asked_at);

CREATE TABLE channel_receipts (
  wamid TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL,
  message_id TEXT
);

CREATE TABLE agent_wake (
  agent TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  last_polled_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE agents (
  agent TEXT PRIMARY KEY,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE owner_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_owner_message_at INTEGER,
  notice_sent_for_closed_window INTEGER NOT NULL,
  routing_list_prompt_message_id TEXT,
  routing_list_opened_at INTEGER,
  routing_list_locale TEXT,
  routing_list_resent INTEGER NOT NULL DEFAULT 0,
  routing_list_reminded INTEGER NOT NULL DEFAULT 0
);

INSERT INTO owner_window (id, last_owner_message_at, notice_sent_for_closed_window) VALUES (1, NULL, 0);

CREATE TABLE media (
  media_id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  filename TEXT,
  expires_at INTEGER,
  received_at INTEGER,
  retention_until INTEGER,
  uploading INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE screen_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  message_id TEXT,
  template TEXT,
  text TEXT NOT NULL,
  options TEXT NOT NULL
);
