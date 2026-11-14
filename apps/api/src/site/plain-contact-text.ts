import { COMPANY } from '@zapbip/types';

export const CONTACT_PLACEHOLDER = '{contactEmail}';

export function plainContactTextOf(input: { text: string }): string {
  return input.text.replaceAll(CONTACT_PLACEHOLDER, COMPANY.contactEmail);
}
