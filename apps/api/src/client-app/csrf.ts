export function csrfTokenOf(_input: { secret: string }): Promise<string> {
  throw new Error('csrfTokenOf is not implemented');
}

export function isCsrfTokenValid(_input: { secret: string; submittedToken: string }): Promise<boolean> {
  throw new Error('isCsrfTokenValid is not implemented');
}
