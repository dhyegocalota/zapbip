CREATE TABLE landing_waitlist (
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  credited INTEGER NOT NULL DEFAULT 0 CHECK (credited IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE INDEX landing_waitlist_referred_by ON landing_waitlist (referred_by, credited);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO site_settings (key, value, updated_at) VALUES ('waitlist_referral_cap', '5', 1794441600000);
