export function contrastOf(_input: { foreground: string; background: string }): number {
  throw new Error('contrast is not implemented');
}

export function compositeOver(_input: { colour: string; backdrop: string }): string {
  throw new Error('contrast is not implemented');
}

export function themeTokens(_input: { stylesheet: string }): { light: Record<string, string>; dark: Record<string, string> } {
  throw new Error('contrast is not implemented');
}
