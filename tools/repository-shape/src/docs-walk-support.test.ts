import { DocsLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  DESKTOP_WIDTH_PX,
  DOCS_LOCALE_OF,
  DOCS_VIEWPORT_HEIGHT_PX,
  DocsViewport,
  NARROW_WIDTH_PX,
  docsOptionsOf,
  isAllowedNoise,
  requestFailedNoiseOf,
} from '../../../apps/docs/e2e/support/docs-experience';

const WIDTH_OF: Record<DocsViewport, number> = {
  [DocsViewport.Desktop]: DESKTOP_WIDTH_PX,
  [DocsViewport.Narrow]: NARROW_WIDTH_PX,
};

const USER_REQUEST_URL = 'http://localhost:3000/_mintlify/api/user';
const ABORTED = 'net::ERR_ABORTED';
const CONNECTION_REFUSED = 'net::ERR_CONNECTION_REFUSED';
const SOCKET_URL = 'http://localhost:3000/socket.io/?EIO=4';

const CASES = Object.values(DocsLanguage).flatMap((language) => Object.values(DocsViewport).map((viewport) => ({ language, viewport })));

describe('docs walk support', () => {
  test.each(CASES)('docsOptionsOf gives the locale and the viewport of $language at $viewport', ({ language, viewport }) => {
    expect(docsOptionsOf({ language, viewport })).toEqual({
      locale: DOCS_LOCALE_OF[language],
      viewport: { width: WIDTH_OF[viewport], height: DOCS_VIEWPORT_HEIGHT_PX },
    });
  });

  test('the locales are the browser locales of the two languages', () => {
    expect(DOCS_LOCALE_OF).toEqual({ [DocsLanguage.English]: 'en-US', [DocsLanguage.PortugueseBrazil]: 'pt-BR' });
  });

  test('a request aborted on the preview user path is allowed noise', () => {
    expect(isAllowedNoise({ entry: requestFailedNoiseOf({ url: USER_REQUEST_URL, errorText: ABORTED }) })).toBe(true);
  });

  test('another failure on the preview user path is not allowed', () => {
    expect(isAllowedNoise({ entry: requestFailedNoiseOf({ url: USER_REQUEST_URL, errorText: CONNECTION_REFUSED }) })).toBe(false);
  });

  test('a 500 response on the preview user path is not allowed', () => {
    expect(isAllowedNoise({ entry: `response 500 ${USER_REQUEST_URL}` })).toBe(false);
  });

  test('an aborted request on another path is not allowed', () => {
    expect(isAllowedNoise({ entry: requestFailedNoiseOf({ url: 'http://localhost:3000/_mintlify/api/other', errorText: ABORTED }) })).toBe(
      false,
    );
  });

  test('the live-reload polling abort stays allowed', () => {
    expect(isAllowedNoise({ entry: requestFailedNoiseOf({ url: SOCKET_URL, errorText: ABORTED }) })).toBe(true);
  });
});
