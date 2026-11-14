import type { PageModel } from './page-model';

export type StructuredDataNode = Record<string, unknown>;
export type StructuredData = { '@context': string; '@graph': StructuredDataNode[] };

export function structuredDataOf(input: { model: PageModel }): StructuredData {
  throw new Error('structuredDataOf is not implemented');
}

export function serializeStructuredData(input: { data: StructuredData }): string {
  throw new Error('serializeStructuredData is not implemented');
}
