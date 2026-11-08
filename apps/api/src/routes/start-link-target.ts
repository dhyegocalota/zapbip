import type { OwnerLocale } from '@zapbip/types';

export function startLinkTarget(input: { displayNumber: string; locale: OwnerLocale }): string | null {
  throw new Error(`startLinkTarget is not implemented for ${input.displayNumber} ${input.locale}`);
}
