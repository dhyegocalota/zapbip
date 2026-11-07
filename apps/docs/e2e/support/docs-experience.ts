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

export function docsOptionsOf(input: { language: DocsLanguage; viewport: DocsViewport }): {
  locale: string;
  viewport: { width: number; height: number };
} {
  throw new Error('docsOptionsOf is not implemented');
}
