CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  agent TEXT NOT NULL,
  secret_digest TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  UNIQUE (account_id, agent)
);

CREATE TABLE owner_identities (
  wa_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts (id),
  from_user_id TEXT,
  locale TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE message_index (
  wamid TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  created_at INTEGER NOT NULL
);
