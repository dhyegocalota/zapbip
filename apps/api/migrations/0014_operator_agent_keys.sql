CREATE TABLE backoffice_agent_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  key_digest TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX backoffice_agent_keys_created_at ON backoffice_agent_keys (created_at);

ALTER TABLE backoffice_audit ADD COLUMN actor_key_id TEXT;
