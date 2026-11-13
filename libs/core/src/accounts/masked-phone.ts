const COUNTRY_DIGITS = 2;
const VISIBLE_TAIL_DIGITS = 4;
const HIDDEN_DIGITS_MARK = '••••';

export function maskedPhoneOf(input: { waId: string }): string {
  const { waId } = input;
  return `+${waId.slice(0, COUNTRY_DIGITS)} ${HIDDEN_DIGITS_MARK}-${waId.slice(-VISIBLE_TAIL_DIGITS)}`;
}
