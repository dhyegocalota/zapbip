CREATE TABLE client_app_sign_in_tokens (
  token_digest TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX client_app_sign_in_tokens_expires_at ON client_app_sign_in_tokens (expires_at);

CREATE TABLE client_app_sessions (
  session_digest TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX client_app_sessions_account_id ON client_app_sessions (account_id);

CREATE INDEX client_app_sessions_expires_at ON client_app_sessions (expires_at);
