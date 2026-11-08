import { ConnectorClient } from '@zapbip/agents/connector';

export const CONNECTOR_CLIENTS = Object.values(ConnectorClient) as unknown as ConnectorClient[];
export const SUBJECT_CLIENT = CONNECTOR_CLIENTS[0] as ConnectorClient;
