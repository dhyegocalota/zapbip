import type { WhatsAppNumberState } from '@zapbip/types';

export type RegisteredNumber = {
  numberId: string;
  phoneNumberId: string;
  wabaId: string;
  state: WhatsAppNumberState;
};

export type OutboundNumber = RegisteredNumber & { accessToken: string };

export type NumberRecord = RegisteredNumber & {
  displayNumber: string;
  label: string;
  verifiedAt: number | null;
  verificationSnapshot: string | null;
  createdAt: number;
  updatedAt: number;
};

export type RegisterNumberInput = {
  phoneNumberId: string;
  wabaId: string;
  displayNumber: string;
  label: string;
  accessToken: string;
  pin: string;
};

export type RegisteredNumberResult = { numberId: string; backfilledAccounts: number };

export interface NumberRegistry {
  registerNumber(input: RegisterNumberInput): Promise<RegisteredNumberResult>;
  findNumber(input: { numberId: string }): Promise<NumberRecord | null>;
  transition(input: { numberId: string; to: WhatsAppNumberState }): Promise<void>;
  findByPhoneNumberIds(input: { phoneNumberIds: string[] }): Promise<RegisteredNumber[]>;
  findByWabaIds(input: { wabaIds: string[] }): Promise<RegisteredNumber[]>;
  openForAccount(input: { accountId: string }): Promise<OutboundNumber>;
  openForInbound(input: { numberId: string }): Promise<OutboundNumber>;
  openTheOnlyNumber(): Promise<OutboundNumber>;
  findStartDisplayNumber(): Promise<string | null>;
}
