CREATE TABLE meta_apps (
  id TEXT PRIMARY KEY,
  meta_app_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sealed_app_secret TEXT NOT NULL,
  seal_key_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE whatsapp_numbers (
  id TEXT PRIMARY KEY,
  meta_app_ref TEXT NOT NULL REFERENCES meta_apps (id),
  phone_number_id TEXT NOT NULL UNIQUE,
  waba_id TEXT NOT NULL,
  display_number TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sealed_access_token TEXT NOT NULL,
  seal_key_version INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'closed', 'disabled')),
  verified_at INTEGER,
  verification_snapshot TEXT,
  credentials_changed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX whatsapp_numbers_waba ON whatsapp_numbers (waba_id);

ALTER TABLE accounts ADD COLUMN number_id TEXT REFERENCES whatsapp_numbers (id);

CREATE INDEX accounts_number ON accounts (number_id);

CREATE TABLE backoffice_operator (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_totp_step INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL,
  locked_until INTEGER
);

INSERT INTO backoffice_operator (id, last_totp_step, failed_attempts, locked_until) VALUES (1, 0, 0, NULL);

CREATE TABLE backoffice_sessions (
  token_digest TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE backoffice_audit (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_kind TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  client_address TEXT
);

CREATE INDEX backoffice_audit_at ON backoffice_audit (at);
