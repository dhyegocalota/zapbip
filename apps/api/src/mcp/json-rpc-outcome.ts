import { z } from 'zod';

const POST_METHOD = 'POST';
const CONTENT_TYPE_HEADER = 'content-type';
const JSON_CONTENT_TYPE = 'application/json';

const successResponseSchema = z.object({ result: z.looseObject({}) });

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function isJsonRpcBatch(input: { request: Request }): Promise<boolean> {
  if (input.request.method !== POST_METHOD) return false;
  return Array.isArray(parseJson(await input.request.clone().text()));
}

export async function isJsonRpcSuccess(input: { response: Response }): Promise<boolean> {
  const isJsonBody = input.response.headers.get(CONTENT_TYPE_HEADER)?.startsWith(JSON_CONTENT_TYPE) === true;
  if (!isJsonBody) return false;
  return successResponseSchema.safeParse(parseJson(await input.response.clone().text())).success;
}
