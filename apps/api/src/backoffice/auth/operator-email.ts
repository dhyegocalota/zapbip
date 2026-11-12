export function normalizeEmail(input: { value: string }): string {
  return input.value.trim().toLowerCase();
}
