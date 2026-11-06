CREATE TABLE account_facts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  first_message_id TEXT,
  deletion_requested_at INTEGER,
  state TEXT
);

CREATE TABLE revoked_agents (
  agent TEXT PRIMARY KEY,
  revoked_at INTEGER NOT NULL
);
