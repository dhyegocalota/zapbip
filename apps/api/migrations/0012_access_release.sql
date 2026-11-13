ALTER TABLE accounts ADD COLUMN released_at INTEGER;

CREATE INDEX accounts_released_at ON accounts (released_at);

CREATE TABLE waitlist_invites (
  code_digest TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX waitlist_invites_email ON waitlist_invites (email);

CREATE INDEX waitlist_invites_created_at ON waitlist_invites (created_at);

CREATE INDEX waitlist_invites_used_at ON waitlist_invites (used_at);

CREATE INDEX landing_waitlist_created_at ON landing_waitlist (created_at);

CREATE INDEX landing_waitlist_locale ON landing_waitlist (locale);
