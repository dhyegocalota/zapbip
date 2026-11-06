import { CONNECTOR_PATH_SUFFIX, MCP_PATH_SUFFIX } from '@zapbip/types';

const SECURE_PROTOCOL = 'https:';
const SOCKET_PROTOCOL = 'wss:';
const INVALID_LINK_MESSAGE = `the connectionLink must be an https link ending in ${MCP_PATH_SUFFIX}`;

export function deriveSocketLink(input: { connectionLink: string }): string {
  const parsed = URL.canParse(input.connectionLink) ? new URL(input.connectionLink) : null;
  const isValid = parsed !== null && parsed.protocol === SECURE_PROTOCOL && parsed.pathname.endsWith(MCP_PATH_SUFFIX);
  if (!isValid) throw new Error(INVALID_LINK_MESSAGE);
  parsed.pathname = `${parsed.pathname.slice(0, -MCP_PATH_SUFFIX.length)}${CONNECTOR_PATH_SUFFIX}`;
  parsed.protocol = SOCKET_PROTOCOL;
  return parsed.toString();
}
