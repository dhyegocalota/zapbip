ALTER TABLE landing_waitlist ADD COLUMN source TEXT NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'agent'));

CREATE INDEX landing_waitlist_source_created_at ON landing_waitlist (source, created_at);
