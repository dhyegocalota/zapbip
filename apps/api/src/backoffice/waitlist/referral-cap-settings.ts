import { isReferralCapInRange } from '../../site/site-settings';

const INTEGER_PATTERN = /^\d+$/;

export function parseReferralCap(input: { value: string | null }): number | null {
  const { value } = input;
  if (value === null || !INTEGER_PATTERN.test(value)) return null;
  const cap = Number(value);
  return isReferralCapInRange({ value: cap }) ? cap : null;
}
