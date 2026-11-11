export enum BackofficeTheme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

const THEME_VALUES: string[] = Object.values(BackofficeTheme);

export function resolveTheme(input: { cookieValue: string | undefined }): BackofficeTheme {
  const { cookieValue } = input;
  if (cookieValue !== undefined && THEME_VALUES.includes(cookieValue)) return cookieValue as BackofficeTheme;
  return BackofficeTheme.System;
}
