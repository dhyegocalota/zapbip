export enum ShellTheme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

const THEME_VALUES: string[] = Object.values(ShellTheme);

export function resolveTheme(input: { cookieValue: string | undefined }): ShellTheme {
  const { cookieValue } = input;
  if (cookieValue !== undefined && THEME_VALUES.includes(cookieValue)) return cookieValue as ShellTheme;
  return ShellTheme.System;
}
