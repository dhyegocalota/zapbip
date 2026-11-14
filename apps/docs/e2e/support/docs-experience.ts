import { createServer } from 'node:net';
import { DocsPageLanguage } from '@zapbip/types';

export enum DocsViewport {
  Desktop = 'desktop',
  Narrow = 'narrow',
}

export const DOCS_PORT_VARIABLE = 'DOCS_PORT';
const LOOPBACK_HOST = '127.0.0.1';
const PATTERN_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
export const DESKTOP_WIDTH_PX = 1280;
export const NARROW_WIDTH_PX = 375;
export const DOCS_VIEWPORT_HEIGHT_PX = 800;
export const DOCS_LOCALE_OF: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'en-US',
  [DocsPageLanguage.PortugueseBrazil]: 'pt-BR',
  [DocsPageLanguage.Spanish]: 'es-ES',
  [DocsPageLanguage.German]: 'de-DE',
  [DocsPageLanguage.French]: 'fr-FR',
  [DocsPageLanguage.Japanese]: 'ja-JP',
  [DocsPageLanguage.Korean]: 'ko-KR',
  [DocsPageLanguage.Chinese]: 'zh-CN',
  [DocsPageLanguage.Arabic]: 'ar-SA',
  [DocsPageLanguage.Hindi]: 'hi-IN',
};

export const DOCS_WALK_NOISE_ALLOWLIST: { patternOf: (input: { origin: string }) => RegExp; reason: string }[] = [
  {
    patternOf: () => /^requestfailed .*\/socket\.io\//,
    reason: 'mint dev holds a live-reload polling request open and the browser aborts it on every navigation',
  },
  {
    patternOf: ({ origin }) => new RegExp(`^requestfailed ${escapedForPattern({ text: origin })}/_mintlify/api/user net::ERR_ABORTED$`),
    reason: 'mint dev asks its preview for the signed-in user and the browser aborts that request when the walk navigates away first',
  },
  {
    patternOf: ({ origin }) =>
      new RegExp(`^requestfailed ${escapedForPattern({ text: origin })}/_mintlify/assets/\\S+\\.js net::ERR_ABORTED$`),
    reason: 'mint dev serves lazily loaded chunks from its own assets path and the browser aborts one when the walk navigates first',
  },
];

function escapedForPattern(input: { text: string }): string {
  return input.text.replace(PATTERN_SPECIAL_CHARACTERS, '\\$&');
}

export function requestFailedNoiseOf(input: { url: string; errorText: string }): string {
  return `requestfailed ${input.url} ${input.errorText}`;
}

export function isAllowedNoise(input: { entry: string; origin: string }): boolean {
  return DOCS_WALK_NOISE_ALLOWLIST.some((allowed) => allowed.patternOf({ origin: input.origin }).test(input.entry));
}

const VIEWPORT_WIDTH_PX_OF: Record<DocsViewport, number> = {
  [DocsViewport.Desktop]: DESKTOP_WIDTH_PX,
  [DocsViewport.Narrow]: NARROW_WIDTH_PX,
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') return reject(new Error('no port assigned'));
      server.close(() => resolve(address.port));
    });
  });
}

export async function docsPortOf(): Promise<number> {
  const chosenPort = process.env[DOCS_PORT_VARIABLE];
  if (chosenPort) return Number(chosenPort);
  const port = await freePort();
  process.env[DOCS_PORT_VARIABLE] = String(port);
  return port;
}

export function docsOptionsOf(input: { language: DocsPageLanguage; viewport: DocsViewport }): {
  locale: string;
  viewport: { width: number; height: number };
} {
  return {
    locale: DOCS_LOCALE_OF[input.language],
    viewport: { width: VIEWPORT_WIDTH_PX_OF[input.viewport], height: DOCS_VIEWPORT_HEIGHT_PX },
  };
}
