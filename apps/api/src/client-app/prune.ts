const PRUNE_STATEMENTS = [
  'DELETE FROM client_app_sign_in_tokens WHERE expires_at <= ?',
  'DELETE FROM client_app_sessions WHERE expires_at <= ?',
];

export async function pruneClientApp(input: { database: D1Database; now: number }): Promise<void> {
  await input.database.batch(PRUNE_STATEMENTS.map((statement) => input.database.prepare(statement).bind(input.now)));
}
