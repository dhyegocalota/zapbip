const WAKE_TIMEOUT_ERROR_NAMES: readonly string[] = ['TimeoutError', 'AbortError'];

export function isWakeTimeout(input: { error: unknown }): boolean {
  const { error } = input;
  if (typeof error !== 'object' || error === null || !('name' in error)) return false;
  return typeof error.name === 'string' && WAKE_TIMEOUT_ERROR_NAMES.includes(error.name);
}
