import { reset } from 'cloudflare:test';
import { HttpStatus } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEE_OTHER_STATUS } from '../../src/backoffice/backoffice-constants';
import { clientAppFetch, prepareClientAppDatabase } from '../support/client-app';

const THEME_COOKIE = '__Host-zb_app_theme';
const HOSTILE_TARGETS = ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/nothing-here', ''];

beforeEach(prepareClientAppDatabase);
afterEach(reset);

describe('the app language menu', () => {
  it.each([
    ['en_US', '/pt-br', '/'],
    ['pt_BR', '/', '/pt-br'],
  ])('posting %s from %s lands on %s', async (locale, from, target) => {
    const response = await clientAppFetch({ path: `${from === '/' ? '' : from}/locale`, method: 'POST', form: { locale, returnTo: from } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('location')).toBe(target);
  });

  it.each(HOSTILE_TARGETS)('never redirects to %s', async (returnTo) => {
    const response = await clientAppFetch({ path: '/locale', method: 'POST', form: { locale: 'pt_BR', returnTo } });
    expect(response.headers.get('location')).toBe('/pt-br');
  });

  it('ignores a locale outside the enum', async () => {
    const response = await clientAppFetch({ path: '/locale', method: 'POST', form: { locale: 'xx_XX', returnTo: '/' } });
    expect(response.headers.get('location')).toBe('/');
  });

  it('refuses a post from another origin', async () => {
    const response = await clientAppFetch({
      path: '/locale',
      method: 'POST',
      form: { locale: 'pt_BR', returnTo: '/' },
      origin: 'https://evil.example',
    });
    expect(response.status).toBe(HttpStatus.Forbidden);
  });
});

describe('the app theme switch', () => {
  it('stores a known theme in a host-locked cookie and returns to the page', async () => {
    const response = await clientAppFetch({ path: '/theme', method: 'POST', form: { theme: 'dark', returnTo: '/' } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('location')).toBe('/');
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith(`${THEME_COOKIE}=`))!;
    expect(cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
  });

  it('ignores a theme outside the enum', async () => {
    const response = await clientAppFetch({ path: '/theme', method: 'POST', form: { theme: 'neon', returnTo: '/' } });
    expect(response.headers.getSetCookie().some((line) => line.startsWith(`${THEME_COOKIE}=`))).toBe(false);
  });

  it('writes the stored theme on the document', async () => {
    const response = await clientAppFetch({ path: '/nothing-here', headers: { Cookie: `${THEME_COOKIE}=dark` } });
    expect(await response.text()).toMatch(/<html[^>]*data-theme="dark"/);
  });

  it('refuses a post from another origin', async () => {
    const response = await clientAppFetch({
      path: '/theme',
      method: 'POST',
      form: { theme: 'dark', returnTo: '/' },
      origin: 'https://evil.example',
    });
    expect(response.status).toBe(HttpStatus.Forbidden);
  });
});
