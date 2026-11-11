export enum BackofficeTheme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

export function resolveTheme(input: { cookieValue: string | undefined }): BackofficeTheme {
  throw new Error(`resolveTheme is not implemented for ${String(input.cookieValue)}`);
}
