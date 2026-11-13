import { DocsPageLanguage } from '@zapbip/types';
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

const ORIGIN = 'http://localhost:3000';
const OTHER_PORT_CHUNK_URL = 'http://localhost:4000/_mintlify/assets/DrawerViewport-Bx7q1Zk0.js';
const USER_REQUEST_URL = 'http://localhost:3000/_mintlify/api/user';
const FOREIGN_USER_REQUEST_URL = 'https://cdn.example.com/_mintlify/api/user';
const OTHER_PORT_USER_REQUEST_URL = 'http://localhost:4000/_mintlify/api/user';
const ABORTED = 'net::ERR_ABORTED';
const CONNECTION_REFUSED = 'net::ERR_CONNECTION_REFUSED';
const CHUNK_URL = 'http://localhost:3000/_mintlify/assets/DrawerViewport-Bx7q1Zk0.js';
const FOREIGN_CHUNK_URL = 'https://cdn.example.com/_mintlify/assets/DrawerViewport-Bx7q1Zk0.js';
const PAGE_URL = 'http://localhost:3000/get-started/how-to-start';
const SOCKET_URL = 'http://localhost:3000/socket.io/?EIO=4';

const CASES = Object.values(DocsPageLanguage).flatMap((language) =>
  Object.values(DocsViewport).map((viewport) => ({ language, viewport })),
);

describe('docs walk support', () => {
  test.each(CASES)('docsOptionsOf gives the locale and the viewport of $language at $viewport', ({ language, viewport }) => {
    expect(docsOptionsOf({ language, viewport })).toEqual({
      locale: DOCS_LOCALE_OF[language],
      viewport: { width: WIDTH_OF[viewport], height: DOCS_VIEWPORT_HEIGHT_PX },
    });
  });

  test('the locales are the browser locales of the two languages', () => {
    expect(DOCS_LOCALE_OF).toEqual({
      [DocsPageLanguage.English]: 'en-US',
      [DocsPageLanguage.PortugueseBrazil]: 'pt-BR',
      [DocsPageLanguage.Spanish]: 'es-ES',
      [DocsPageLanguage.German]: 'de-DE',
      [DocsPageLanguage.French]: 'fr-FR',
      [DocsPageLanguage.Japanese]: 'ja-JP',
      [DocsPageLanguage.Korean]: 'ko-KR',
      [DocsPageLanguage.Chinese]: 'zh-CN',
    });
  });

  test('a request aborted on the preview user path is allowed noise', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: USER_REQUEST_URL, errorText: ABORTED }) })).toBe(true);
  });

  test.each([FOREIGN_USER_REQUEST_URL, OTHER_PORT_USER_REQUEST_URL])('an aborted user request from %s is not allowed', (url) => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url, errorText: ABORTED }) })).toBe(false);
  });

  test('another failure on the preview user path is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: USER_REQUEST_URL, errorText: CONNECTION_REFUSED }) })).toBe(
      false,
    );
  });

  test('a 500 response on the preview user path is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: `response 500 ${USER_REQUEST_URL}` })).toBe(false);
  });

  test('an aborted request on another path is not allowed', () => {
    expect(
      isAllowedNoise({
        origin: ORIGIN,
        entry: requestFailedNoiseOf({ url: 'http://localhost:3000/_mintlify/api/other', errorText: ABORTED }),
      }),
    ).toBe(false);
  });

  test('the live-reload polling abort stays allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: SOCKET_URL, errorText: ABORTED }) })).toBe(true);
  });

  test('an aborted same-origin chunk under the mint assets path is allowed noise', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: CHUNK_URL, errorText: ABORTED }) })).toBe(true);
  });

  test('an aborted cross-origin chunk is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: FOREIGN_CHUNK_URL, errorText: ABORTED }) })).toBe(false);
  });

  test('a same-origin chunk that is refused is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: CHUNK_URL, errorText: CONNECTION_REFUSED }) })).toBe(false);
  });

  test('a same-origin chunk that answers 404 is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: `response 404 ${CHUNK_URL}` })).toBe(false);
  });

  test('an aborted same-origin page navigation is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: PAGE_URL, errorText: ABORTED }) })).toBe(false);
  });

  test('an aborted chunk from another localhost port is not allowed', () => {
    expect(isAllowedNoise({ origin: ORIGIN, entry: requestFailedNoiseOf({ url: OTHER_PORT_CHUNK_URL, errorText: ABORTED }) })).toBe(false);
  });
});
