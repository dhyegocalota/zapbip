import { OwnerLocale } from '@zapbip/types';
import { renderSiteCopy, type SiteCopyKey } from '../../../src/site/site-copy';

export function siteCopy(input: { key: SiteCopyKey; locale?: OwnerLocale; values?: Record<string, string> }): string {
  const { key, locale = OwnerLocale.EnglishUs, values } = input;
  return renderSiteCopy({ key, locale, values });
}
