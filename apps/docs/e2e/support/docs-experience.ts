import { DocsLanguage } from '@zapbip/types';

export enum DocsViewport {
  Desktop = 'desktop',
  Narrow = 'narrow',
}

export const DOCS_PORT = 3310;
export const DESKTOP_WIDTH_PX = 1280;
export const NARROW_WIDTH_PX = 375;
export const DOCS_VIEWPORT_HEIGHT_PX = 800;
export const DOCS_LOCALE_OF: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'en-US',
  [DocsLanguage.PortugueseBrazil]: 'pt-BR',
};

const VIEWPORT_WIDTH_PX_OF: Record<DocsViewport, number> = {
  [DocsViewport.Desktop]: DESKTOP_WIDTH_PX,
  [DocsViewport.Narrow]: NARROW_WIDTH_PX,
};

export function docsOptionsOf(input: { language: DocsLanguage; viewport: DocsViewport }): {
  locale: string;
  viewport: { width: number; height: number };
} {
  return {
    locale: DOCS_LOCALE_OF[input.language],
    viewport: { width: VIEWPORT_WIDTH_PX_OF[input.viewport], height: DOCS_VIEWPORT_HEIGHT_PX },
  };
}
