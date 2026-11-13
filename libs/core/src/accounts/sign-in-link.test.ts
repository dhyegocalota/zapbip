import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { buildSignInLink } from './sign-in-link';

const APP_ORIGIN = 'https://app.zapbip.com';

describe('buildSignInLink', () => {
  test('an English owner gets the root path', () => {
    expect(buildSignInLink({ appOrigin: APP_ORIGIN, locale: OwnerLocale.EnglishUs, token: 'abc' })).toBe(`${APP_ORIGIN}/sign-in/abc`);
  });

  test('a Portuguese owner gets the pt-br path', () => {
    expect(buildSignInLink({ appOrigin: APP_ORIGIN, locale: OwnerLocale.PortugueseBrazil, token: 'abc' })).toBe(
      `${APP_ORIGIN}/pt-br/sign-in/abc`,
    );
  });
});
