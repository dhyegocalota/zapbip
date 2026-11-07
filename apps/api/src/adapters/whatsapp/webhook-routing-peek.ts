import { z } from 'zod';

export type WebhookRouting = { phoneNumberIds: string[]; wabaIds: string[] };

const routingSchema = z.object({
  entry: z.array(
    z.object({
      id: z.string().optional(),
      changes: z
        .array(z.object({ value: z.object({ metadata: z.object({ phone_number_id: z.string().optional() }).optional() }).optional() }))
        .default([]),
    }),
  ),
});

function parseJson(input: { text: string }): { isValid: true; value: unknown } | { isValid: false } {
  try {
    return { isValid: true, value: JSON.parse(input.text) as unknown };
  } catch {
    return { isValid: false };
  }
}

function distinct(input: { values: string[] }): string[] {
  return [...new Set(input.values)];
}

export function peekWebhookRouting(input: { text: string }): WebhookRouting | null {
  const json = parseJson({ text: input.text });
  if (!json.isValid) return null;
  const notification = routingSchema.safeParse(json.value);
  if (!notification.success) return null;
  const changes = notification.data.entry.flatMap((entry) => entry.changes.map((change) => ({ wabaId: entry.id, change })));
  const phoneNumberIds = changes.flatMap(({ change }) => {
    const phoneNumberId = change.value?.metadata?.phone_number_id;
    return phoneNumberId === undefined ? [] : [phoneNumberId];
  });
  const wabaIds = changes.flatMap(({ wabaId, change }) => {
    const hasMetadata = change.value?.metadata?.phone_number_id !== undefined;
    return hasMetadata || wabaId === undefined ? [] : [wabaId];
  });
  const routing = { phoneNumberIds: distinct({ values: phoneNumberIds }), wabaIds: distinct({ values: wabaIds }) };
  const isRoutable = routing.phoneNumberIds.length + routing.wabaIds.length > 0;
  return isRoutable ? routing : null;
}
