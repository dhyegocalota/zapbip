import { LinkPurpose } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { signLink, verifyLink } from '../../src/signing';

const ISSUED_AT = 1_000;
const EXPIRES_AT = 5_000;
const baseLink = {
  key: 'media-key',
  accountId: 'acc_1',
  mediaId: 'med_1',
  purpose: LinkPurpose.Read,
  expiresAt: EXPIRES_AT,
};

async function verifyWith(input: Partial<Parameters<typeof verifyLink>[0]>): Promise<boolean> {
  const signature = await signLink(baseLink);
  return verifyLink({ ...baseLink, signature, now: ISSUED_AT, ...input });
}

describe('signing', () => {
  it('verifies the link it signed', async () => {
    expect(await verifyWith({})).toBe(true);
  });

  it('rejects a changed media id', async () => {
    expect(await verifyWith({ mediaId: 'med_2' })).toBe(false);
  });

  it('rejects a changed account id', async () => {
    expect(await verifyWith({ accountId: 'acc_2' })).toBe(false);
  });

  it('rejects a changed expiry', async () => {
    expect(await verifyWith({ expiresAt: EXPIRES_AT + 1 })).toBe(false);
  });

  it('rejects a changed purpose', async () => {
    expect(await verifyWith({ purpose: LinkPurpose.Upload })).toBe(false);
  });

  it('rejects a changed key', async () => {
    expect(await verifyWith({ key: 'upload-key' })).toBe(false);
  });

  it('rejects a link whose expiry has passed', async () => {
    expect(await verifyWith({ now: EXPIRES_AT + 1 })).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', async () => {
    expect(await verifyWith({ signature: 'abc' })).toBe(false);
  });

  it('rejects a signature that is not base64url without throwing', async () => {
    expect(await verifyWith({ signature: '!!!!' })).toBe(false);
  });
});
