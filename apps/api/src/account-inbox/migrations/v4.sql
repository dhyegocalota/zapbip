ALTER TABLE inbox_messages ADD COLUMN channel_message_id TEXT;
ALTER TABLE inbox_messages ADD COLUMN error_code INTEGER;
ALTER TABLE inbox_messages ADD COLUMN error_title TEXT;
ALTER TABLE inbox_messages ADD COLUMN pricing_category TEXT;
ALTER TABLE inbox_messages ADD COLUMN billable INTEGER;
ALTER TABLE inbox_messages ADD COLUMN claimed_at INTEGER;

CREATE UNIQUE INDEX inbox_messages_channel_message_id ON inbox_messages (channel_message_id);

ALTER TABLE owner_window ADD COLUMN closed_at INTEGER;
ALTER TABLE inbox_messages ADD COLUMN forwarded TEXT NOT NULL DEFAULT 'none';
