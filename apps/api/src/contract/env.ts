import type { DeployEnvironment } from './deploy-environment';
import type { AccountInbox } from '../account-inbox/account-inbox';

export type Bindings = {
  ACCOUNT_INBOX: DurableObjectNamespace<AccountInbox>;
  ENVIRONMENT: DeployEnvironment;
  CONNECTIONS: D1Database;
  MEDIA: R2Bucket;
  MEDIA_LINK_SIGNING_KEY: string;
  UPLOAD_LINK_SIGNING_KEY: string;
  PUBLIC_ORIGIN: string;
  WAITLIST_ENABLED: string;
  OWNER_RATE_LIMITER: RateLimit;
  OUTBOUND_RATE_LIMITER: RateLimit;
  ACCOUNT_OUTBOUND_RATE_LIMITER: RateLimit;
  INSTALL_PAGE_LIMITER: RateLimit;
  META_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_BASE_URL?: string;
  WHATSAPP_MEDIA_DOWNLOAD_ORIGIN?: string;
  WAKE_SECRET_KEY: string;
  WAKE_METRICS: AnalyticsEngineDataset;
};
