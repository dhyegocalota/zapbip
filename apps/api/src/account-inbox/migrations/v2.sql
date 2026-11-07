ALTER TABLE agent_wake ADD COLUMN provider TEXT;
ALTER TABLE agent_wake ADD COLUMN host TEXT;
ALTER TABLE agent_wake ADD COLUMN sealed_target TEXT;
ALTER TABLE agent_wake ADD COLUMN key_version INTEGER;
ALTER TABLE agent_wake ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE agent_wake ADD COLUMN last_delivered_at INTEGER;

CREATE TABLE wake_jobs (
  agent TEXT PRIMARY KEY,
  due_at INTEGER NOT NULL,
  attempt INTEGER NOT NULL,
  lease_until INTEGER,
  rewake INTEGER NOT NULL,
  last_outcome TEXT
);

CREATE INDEX wake_jobs_due_at ON wake_jobs (due_at);
