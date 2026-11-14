import type { PageModel } from './page-model';

export type PageMeta = { title: string; description: string; openGraphTitle: string };

export function pageMetaOf(input: { model: PageModel; title: string }): PageMeta {
  throw new Error('pageMetaOf is not implemented');
}
