export async function csrfTokenOf(_input: { sessionToken: string }): Promise<string> {
  throw new Error('csrfTokenOf is not implemented');
}

export async function isSessionCsrfTokenValid(_input: { sessionToken: string; submittedToken: string }): Promise<boolean> {
  throw new Error('isSessionCsrfTokenValid is not implemented');
}
