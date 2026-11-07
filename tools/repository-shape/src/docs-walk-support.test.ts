import { DocsLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  DESKTOP_WIDTH_PX,
  DOCS_LOCALE_OF,
  DOCS_VIEWPORT_HEIGHT_PX,
  DocsViewport,
  NARROW_WIDTH_PX,
  docsOptionsOf,
} from '../../../apps/docs/e2e/support/docs-experience';

const WIDTH_OF: Record<DocsViewport, number> = {
  [DocsViewport.Desktop]: DESKTOP_WIDTH_PX,
  [DocsViewport.Narrow]: NARROW_WIDTH_PX,
};

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
});
