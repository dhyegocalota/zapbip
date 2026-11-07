CREATE TABLE channel_restrictions (
  phone_number_id TEXT PRIMARY KEY,
  error_code INTEGER NOT NULL,
  restricted_at INTEGER NOT NULL
);
