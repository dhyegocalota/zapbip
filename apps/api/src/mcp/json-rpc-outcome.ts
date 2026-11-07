import { z } from 'zod';

const POST_METHOD = 'POST';

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
  return successResponseSchema.safeParse(parseJson(await input.response.clone().text())).success;
}
