CREATE TABLE meta_onboarding_guard (foreign_apps INTEGER NOT NULL CHECK (foreign_apps = 0));

INSERT INTO meta_onboarding_guard (foreign_apps) SELECT COUNT(*) FROM meta_apps WHERE meta_app_id <> '714836811568009';

DROP TABLE meta_onboarding_guard;

PRAGMA defer_foreign_keys = true;

CREATE TABLE whatsapp_numbers_before_onboarding AS SELECT * FROM whatsapp_numbers;

DROP TABLE whatsapp_numbers;

CREATE TABLE whatsapp_numbers (
  id TEXT PRIMARY KEY,
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

INSERT INTO whatsapp_numbers (id, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, verified_at, verification_snapshot, credentials_changed_at, created_at, updated_at)
SELECT id, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, verified_at, verification_snapshot, credentials_changed_at, created_at, updated_at
FROM whatsapp_numbers_before_onboarding;

DROP TABLE whatsapp_numbers_before_onboarding;

CREATE INDEX whatsapp_numbers_waba ON whatsapp_numbers (waba_id);

DROP TABLE meta_apps;

ALTER TABLE backoffice_sessions ADD COLUMN onboarding_grant_until INTEGER;
