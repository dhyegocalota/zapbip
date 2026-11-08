import { createServer } from 'node:net';
import { DocsLanguage } from '@zapbip/types';

export enum DocsViewport {
  Desktop = 'desktop',
  Narrow = 'narrow',
}

export const DOCS_PORT_VARIABLE = 'DOCS_PORT';
const LOOPBACK_HOST = '127.0.0.1';
export const DESKTOP_WIDTH_PX = 1280;
export const NARROW_WIDTH_PX = 375;
export const DOCS_VIEWPORT_HEIGHT_PX = 800;
export const DOCS_LOCALE_OF: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'en-US',
  [DocsLanguage.PortugueseBrazil]: 'pt-BR',
};

export const DOCS_WALK_NOISE_ALLOWLIST: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^requestfailed .*\/socket\.io\//,
    reason: 'mint dev holds a live-reload polling request open and the browser aborts it on every navigation',
  },
];

export function requestFailedNoiseOf(input: { url: string; errorText: string }): string {
  throw new Error('requestFailedNoiseOf is not implemented');
}

export function isAllowedNoise(input: { entry: string }): boolean {
  throw new Error('isAllowedNoise is not implemented');
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

export function docsOptionsOf(input: { language: DocsLanguage; viewport: DocsViewport }): {
  locale: string;
  viewport: { width: number; height: number };
} {
  return {
    locale: DOCS_LOCALE_OF[input.language],
    viewport: { width: VIEWPORT_WIDTH_PX_OF[input.viewport], height: DOCS_VIEWPORT_HEIGHT_PX },
  };
}
