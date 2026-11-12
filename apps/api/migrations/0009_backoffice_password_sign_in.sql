ALTER TABLE backoffice_operator ADD COLUMN email TEXT;

ALTER TABLE backoffice_operator ADD COLUMN password_hash TEXT;

CREATE UNIQUE INDEX backoffice_operator_email ON backoffice_operator (email);

CREATE TABLE backoffice_pending_sign_ins (
  token_digest TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

DELETE FROM backoffice_sessions;
