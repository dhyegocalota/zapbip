ALTER TABLE landing_waitlist ADD COLUMN source TEXT NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'agent'));
