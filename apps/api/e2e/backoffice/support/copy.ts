import { OwnerLocale } from '@zapbip/types';
import { type BackofficeCopyKey, renderBackofficeCopy } from '../../../src/backoffice/backoffice-copy';

export function copy(input: { key: BackofficeCopyKey; values?: Record<string, string> }): string {
  return renderBackofficeCopy({ key: input.key, locale: OwnerLocale.PortugueseBrazil, values: input.values });
}
