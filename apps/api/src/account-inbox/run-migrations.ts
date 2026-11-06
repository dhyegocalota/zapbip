export type Migration = { version: number; sql: string };

export function runMigrations(input: { storage: DurableObjectStorage; migrations: Migration[] }): number[] {
  void input;
  throw new Error('runMigrations is not implemented');
}
