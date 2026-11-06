import { LinkPurpose } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { readSignedQuery, signLink, verifyLink } from '../../src/signing';

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

  it('rejects a last character that decodes to the same bytes', async () => {
    const signature = await signLink(baseLink);
    const lastCharacter = signature.at(-1) as string;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const sameBytesCharacter = [...alphabet].find(
      (character) =>
        character !== lastCharacter && Math.floor(alphabet.indexOf(character) / 4) === Math.floor(alphabet.indexOf(lastCharacter) / 4),
    );
    expect(await verifyWith({ signature: `${signature.slice(0, -1)}${sameBytesCharacter}` })).toBe(false);
  });

  it('rejects a padded signature', async () => {
    const signature = await signLink(baseLink);
    expect(await verifyWith({ signature: `${signature}=` })).toBe(false);
  });

  it('rejects a standard base64 signature', async () => {
    const signature = await signLink(baseLink);
    const standard = Buffer.from(signature, 'base64url').toString('base64');
    expect(await verifyWith({ signature: standard })).toBe(false);
  });

  it('does not let a newline in an id move bytes between fields', async () => {
    const signature = await signLink({ ...baseLink, accountId: 'acc_1', mediaId: 'med_1' });
    const shifted = await verifyLink({ ...baseLink, accountId: 'acc_1\nmed_1', mediaId: '', signature, now: ISSUED_AT });
    expect(shifted).toBe(false);
  });
});

describe('readSignedQuery', () => {
  it('reads a canonical expiry and signature', () => {
    expect(readSignedQuery({ expiries: ['5000'], signatures: ['abc'] })).toEqual({ expiresAt: 5000, signature: 'abc' });
  });

  it.each(['0', '05', '+5', '-5', ' 5', '5 ', '5.0', '1e3', '', 'abc'])('rejects the expiry %j', (expiry) => {
    expect(readSignedQuery({ expiries: [expiry], signatures: ['abc'] })).toBeNull();
  });

  it('rejects a repeated expiry or signature', () => {
    expect(readSignedQuery({ expiries: ['5000', '6000'], signatures: ['abc'] })).toBeNull();
    expect(readSignedQuery({ expiries: ['5000'], signatures: ['abc', 'def'] })).toBeNull();
  });

  it('rejects a missing expiry or signature', () => {
    expect(readSignedQuery({ expiries: undefined, signatures: ['abc'] })).toBeNull();
    expect(readSignedQuery({ expiries: ['5000'], signatures: undefined })).toBeNull();
  });
});
