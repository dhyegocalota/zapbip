const RECORD_CLIENT_NAME_STATEMENT = 'UPDATE connections SET client_name = ? WHERE id = ? AND client_name IS NULL';

export async function recordClientName(input: { database: D1Database; connectionId: string; clientName: string }): Promise<void> {
  await input.database.prepare(RECORD_CLIENT_NAME_STATEMENT).bind(input.clientName, input.connectionId).run();
}
