ALTER TABLE agent_wake ADD COLUMN interval_minutes INTEGER;
ALTER TABLE agent_wake ADD COLUMN standby_agent TEXT;
ALTER TABLE agent_wake ADD COLUMN owner_locale TEXT;
ALTER TABLE agent_wake ADD COLUMN has_polled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_wake ADD COLUMN poller_stale_notified INTEGER NOT NULL DEFAULT 0;

ALTER TABLE inbox_messages ADD COLUMN handed_to TEXT;
ALTER TABLE inbox_messages ADD COLUMN origin_message_id TEXT;

CREATE INDEX inbox_messages_unread ON inbox_messages (agent) WHERE read_at IS NULL;
