const VISIBLE_TAIL_DIGITS = 4;
const HIDDEN_DIGITS_MARK = '••••';

export function maskedPhoneOf(input: { waId: string }): string {
  return `${HIDDEN_DIGITS_MARK}-${input.waId.slice(-VISIBLE_TAIL_DIGITS)}`;
}
