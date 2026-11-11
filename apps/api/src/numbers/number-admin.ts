import type { NumberRecord } from './number-registry';

export type NumberListEntry = NumberRecord & {
  credentialsChangedAt: number;
  accountCount: number;
};

export interface NumberAdmin {
  listNumbers(): Promise<NumberListEntry[]>;
  recordVerification(input: { numberId: string; snapshot: string; verifiedAt: number | null }): Promise<void>;
  replaceAccessToken(input: { numberId: string; accessToken: string }): Promise<void>;
}
