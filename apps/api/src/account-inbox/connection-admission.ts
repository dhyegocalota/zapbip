import type { ConnectionIdentity } from '@zapbip/core';

export async function isConnectionAdmitted(input: { database: D1Database; connection: ConnectionIdentity }): Promise<boolean> {
  throw new Error(`isConnectionAdmitted is not implemented for ${input.connection.agent}`);
}
