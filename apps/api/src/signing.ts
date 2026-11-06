import type { LinkPurpose } from '@zapbip/types';

export function canonicalLinkString(input: { accountId: string; mediaId: string; purpose: LinkPurpose; expiresAt: number }): string {
  return [input.purpose, input.accountId, input.mediaId, String(input.expiresAt)].join('\n');
}

export function signLink(input: {
  key: string;
  accountId: string;
  mediaId: string;
  purpose: LinkPurpose;
  expiresAt: number;
}): Promise<string> {
  void input;
  throw new Error('signLink is not implemented');
}

export function verifyLink(input: {
  key: string;
  accountId: string;
  mediaId: string;
  purpose: LinkPurpose;
  expiresAt: number;
  signature: string;
  now: number;
}): Promise<boolean> {
  void input;
  throw new Error('verifyLink is not implemented');
}
