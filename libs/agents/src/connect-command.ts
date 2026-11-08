import { CONNECTION_URL_VARIABLE, ZAPBIP_NPX } from '@zapbip/core';
import type { ConnectorClient } from './generated/ids';

export function connectCommand(input: { connectionLink: string; client: ConnectorClient }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} connect --client ${input.client}`;
}
