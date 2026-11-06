export type DirectorySeed = { connections: { agent: string; secret: string }[]; statements: string[] };

export function buildDirectorySeed(input: { phone: string; agents: string[]; createdAt: number }): Promise<DirectorySeed> {
  void input;
  throw new Error('buildDirectorySeed is not implemented');
}

export function findOwnerStatement(input: { phone: string }): string {
  void input;
  throw new Error('findOwnerStatement is not implemented');
}

export function assertOwnerAbsent(input: { existingCount: number }): void {
  void input;
  throw new Error('assertOwnerAbsent is not implemented');
}
