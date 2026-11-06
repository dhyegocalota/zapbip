CREATE TABLE usage_meter (
  day TEXT PRIMARY KEY,
  gigabyte_seconds REAL NOT NULL,
  flushed_gigabyte_seconds REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  last_flushed_at INTEGER
);
