CREATE TABLE activity_meter (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL,
  flushed_count INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  last_flushed_at INTEGER,
  PRIMARY KEY (day, metric)
);
