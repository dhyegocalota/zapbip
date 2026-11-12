export function hashPassword(input: { password: string; pepper: string }): Promise<string> {
  throw new Error('hashPassword is not implemented');
}

export function verifyPassword(input: { password: string; pepper: string; storedHash: string }): Promise<boolean> {
  throw new Error('verifyPassword is not implemented');
}
