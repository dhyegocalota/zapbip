CREATE TABLE usage_daily (
  day TEXT NOT NULL,
  account_id TEXT NOT NULL,
  gigabyte_seconds REAL NOT NULL,
  PRIMARY KEY (day, account_id)
);
