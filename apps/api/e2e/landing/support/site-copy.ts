import { WebLocale } from '@zapbip/types';
import { renderShellCopy, type ShellCopyKey } from '../../../src/web-shell/shell-copy';
import { renderSiteCopy, type SiteCopyKey } from '../../../src/site/site-copy';

export function shellCopy(input: { key: ShellCopyKey; locale?: WebLocale }): string {
  const { key, locale = WebLocale.EnglishUs } = input;
  return renderShellCopy({ key, locale });
}

export function siteCopy(input: { key: SiteCopyKey; locale?: WebLocale; values?: Record<string, string> }): string {
  const { key, locale = WebLocale.EnglishUs, values } = input;
  return renderSiteCopy({ key, locale, values });
}
