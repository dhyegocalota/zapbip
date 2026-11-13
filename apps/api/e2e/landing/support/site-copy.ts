import { OwnerLocale } from '@zapbip/types';
import { renderShellCopy, type ShellCopyKey } from '../../../src/web-shell/shell-copy';
import { renderSiteCopy, type SiteCopyKey } from '../../../src/site/site-copy';

export function shellCopy(input: { key: ShellCopyKey; locale?: OwnerLocale }): string {
  const { key, locale = OwnerLocale.EnglishUs } = input;
  return renderShellCopy({ key, locale });
}

export function siteCopy(input: { key: SiteCopyKey; locale?: OwnerLocale; values?: Record<string, string> }): string {
  const { key, locale = OwnerLocale.EnglishUs, values } = input;
  return renderSiteCopy({ key, locale, values });
}
