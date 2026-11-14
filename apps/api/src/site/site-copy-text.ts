import type { WebLocale } from '@zapbip/types';
import { renderSiteCopy, type SiteCopyKey } from './site-copy';

export function copyOf(input: { locale: WebLocale }): (key: SiteCopyKey, values?: Record<string, string>) => string {
  return (key, values) => renderSiteCopy({ key, locale: input.locale, values });
}
