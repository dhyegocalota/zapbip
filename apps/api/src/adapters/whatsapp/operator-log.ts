import type { OperatorEvent, OperatorLogField } from './whatsapp-enums';

export function logOperatorEvent(input: {
  event: OperatorEvent;
  fields: Partial<Record<OperatorLogField, string | number | boolean>>;
}): void {
  void input;
  throw new Error('logOperatorEvent is not implemented');
}
