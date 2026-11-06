DROP TABLE IF EXISTS message_index;
DROP TABLE IF EXISTS owner_identities;
DROP TABLE IF EXISTS connections;
DROP TABLE IF EXISTS accounts;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('waitlisted', 'active', 'suspended', 'deleting')),
  created_at INTEGER NOT NULL
);

CREATE INDEX accounts_created_at ON accounts (created_at);

CREATE TABLE owner_identities (
  wa_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  from_user_id TEXT,
  locale TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  agent TEXT NOT NULL,
  secret_digest TEXT NOT NULL UNIQUE,
  client_name TEXT,
  created_at INTEGER NOT NULL,
  rotated_at INTEGER,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX connections_active_agent ON connections (account_id, agent) WHERE revoked_at IS NULL;

CREATE TABLE message_index (
  wamid TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  created_at INTEGER NOT NULL
);

CREATE TABLE blocked_phones (
  wa_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
