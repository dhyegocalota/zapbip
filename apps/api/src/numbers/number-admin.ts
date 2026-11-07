import type { NumberRecord } from './number-registry';

export type NumberListEntry = NumberRecord & { metaAppLabel: string; metaAppUpdatedAt: number; accountCount: number };

export type MetaAppRecord = { metaAppRef: string; metaAppId: string; label: string; updatedAt: number };

export interface NumberAdmin {
  listNumbers(): Promise<NumberListEntry[]>;
  listMetaApps(): Promise<MetaAppRecord[]>;
  recordVerification(input: { numberId: string; snapshot: string; verifiedAt: number | null }): Promise<void>;
  replaceAccessToken(input: { numberId: string; accessToken: string }): Promise<void>;
  replaceAppSecret(input: { metaAppRef: string; appSecret: string }): Promise<void>;
}
