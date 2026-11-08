import type { OwnerLocale } from '@zapbip/types';

export function startLinkLocaleOf(input: { values: string[] | undefined }): OwnerLocale | null {
  throw new Error(`startLinkLocaleOf is not implemented for ${String(input.values)}`);
}
