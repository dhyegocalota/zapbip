import type { AccountInbox } from '../account-inbox/account-inbox';

export type Bindings = {
  ACCOUNT_INBOX: DurableObjectNamespace<AccountInbox>;
  CONNECTIONS: D1Database;
  MEDIA: R2Bucket;
  MEDIA_LINK_SIGNING_KEY: string;
  UPLOAD_LINK_SIGNING_KEY: string;
  PUBLIC_ORIGIN: string;
  WAITLIST_ENABLED: string;
  OWNER_RATE_LIMITER: RateLimit;
  OUTBOUND_RATE_LIMITER: RateLimit;
  ACCOUNT_OUTBOUND_RATE_LIMITER: RateLimit;
};
