import { CLIENT_NAME_MAX_CHARS, INITIALIZE_BODY_MAX_BYTES } from '@zapbip/types';
import { z } from 'zod';
import type { ConnectionActivity } from '../adapters/d1/d1-connection-directory';

const INITIALIZE_METHOD = 'initialize';
const POST_METHOD = 'POST';
const CONTENT_LENGTH_HEADER = 'content-length';

const CLIENT_NAME_PATTERN = new RegExp(`^[\\x20-\\x7E]{1,${CLIENT_NAME_MAX_CHARS}}$`);

const initializeSchema = z.object({
  method: z.literal(INITIALIZE_METHOD),
  params: z.object({ clientInfo: z.object({ name: z.string().regex(CLIENT_NAME_PATTERN) }) }),
});

export type ConnectionRecorders = {
  recordClientName(input: { connectionId: string; clientName: string }): Promise<void>;
  recordFirstCall(input: { connectionId: string; calledAt: number }): Promise<void>;
};

export type ConnectionActivityInput = {
  request: Request;
  connection: ConnectionActivity;
  recorders: ConnectionRecorders;
  calledAt: number;
  schedule: (work: Promise<void>) => void;
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isBodyWithinCap(input: { request: Request }): boolean {
  const contentLength = input.request.headers.get(CONTENT_LENGTH_HEADER);
  if (contentLength === null) return false;
  return Number(contentLength) <= INITIALIZE_BODY_MAX_BYTES;
}

async function recordNameFromBody(input: { body: Request; connectionId: string; recorders: ConnectionRecorders }): Promise<void> {
  const clientName = readInitializeClientName({ requestText: await input.body.text() });
  if (clientName === null) return;
  await input.recorders.recordClientName({ connectionId: input.connectionId, clientName });
}

export function readInitializeClientName(input: { requestText: string }): string | null {
  const parsed = initializeSchema.safeParse(parseJson(input.requestText));
  if (!parsed.success) return null;
  return parsed.data.params.clientInfo.name;
}

export function recordConnectionActivity(input: ConnectionActivityInput): void {
  const { request, connection, recorders, calledAt, schedule } = input;
  if (request.method !== POST_METHOD) return;
  const { connectionId } = connection;
  if (connection.firstCallAt === null) schedule(recorders.recordFirstCall({ connectionId, calledAt }));
  const shouldReadName = connection.clientName === null && isBodyWithinCap({ request });
  if (!shouldReadName) return;
  schedule(recordNameFromBody({ body: request.clone(), connectionId, recorders }));
}
