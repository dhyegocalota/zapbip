import { describe, expect, it } from 'vitest';
import type { Bindings } from '../../src/contract/env';
import { readDevelopmentMediaOrigin } from '../../src/dev/read-development-media-origin';

const ORIGIN = 'http://127.0.0.1:4011';

describe('readDevelopmentMediaOrigin', () => {
  it('returns the origin when the binding is set', () => {
    expect(readDevelopmentMediaOrigin({ env: { WHATSAPP_MEDIA_DOWNLOAD_ORIGIN: ORIGIN } as Bindings })).toBe(ORIGIN);
  });

  it('returns null when the binding is absent', () => {
    expect(readDevelopmentMediaOrigin({ env: {} as Bindings })).toBeNull();
  });

  it('returns null when the binding is empty', () => {
    expect(readDevelopmentMediaOrigin({ env: { WHATSAPP_MEDIA_DOWNLOAD_ORIGIN: '' } as Bindings })).toBeNull();
  });
});
