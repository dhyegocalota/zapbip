const OPERATOR_EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;

export function normalizeEmail(input: { value: string }): string {
  return input.value.trim().toLowerCase();
}

export function isOperatorEmailAllowed(input: { value: string }): boolean {
  return OPERATOR_EMAIL_PATTERN.test(input.value);
}
