CREATE TABLE activity_daily (
  day TEXT NOT NULL,
  account_id TEXT NOT NULL,
  number_id TEXT,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, account_id, metric)
);

CREATE INDEX activity_daily_number ON activity_daily (number_id, day);
