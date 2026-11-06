import type { OperatorEvent, OperatorLogField } from './whatsapp-enums';

export function logOperatorEvent(input: {
  event: OperatorEvent;
  fields: Partial<Record<OperatorLogField, string | number | boolean | null>>;
}): void {
  console.error(JSON.stringify({ event: input.event, ...input.fields }));
}
