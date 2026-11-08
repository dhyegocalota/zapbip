const MISSING_ENTRY_CODE = 'ENOENT';

export function isMissingEntry(input: { error: unknown }): boolean {
  return input.error instanceof Error && 'code' in input.error && input.error.code === MISSING_ENTRY_CODE;
}
