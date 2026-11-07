import type { WhatsAppNumberState } from '@zapbip/types';

export type RegisteredNumber = {
  numberId: string;
  phoneNumberId: string;
  wabaId: string;
  state: WhatsAppNumberState;
  metaAppRef: string;
};

export type OutboundNumber = RegisteredNumber & { accessToken: string };

export interface NumberRegistry {
  findByPhoneNumberIds(input: { phoneNumberIds: string[] }): Promise<RegisteredNumber[]>;
  findByWabaIds(input: { wabaIds: string[] }): Promise<RegisteredNumber[]>;
  openAppSecret(input: { metaAppRef: string }): Promise<string>;
  openForAccount(input: { accountId: string }): Promise<OutboundNumber>;
  openForInbound(input: { numberId: string }): Promise<OutboundNumber>;
  openTheOnlyNumber(): Promise<OutboundNumber>;
}
