import { parseJsonOrNull } from './json-text';

export type PackageAnswer = { status: number; body: unknown };
export type PackageFetcher = (input: { url: string; xmlBody?: string }) => Promise<PackageAnswer>;

const XML_CONTENT_TYPE = 'text/xml';

export function createPackageFetcher(): PackageFetcher {
  return async ({ url, xmlBody }) => {
    if (xmlBody !== undefined) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': XML_CONTENT_TYPE }, body: xmlBody });
      return { status: response.status, body: await response.text() };
    }
    const response = await fetch(url);
    return { status: response.status, body: parseJsonOrNull({ text: await response.text() }) };
  };
}
