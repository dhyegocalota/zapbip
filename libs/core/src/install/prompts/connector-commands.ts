export const ZAPBIP_NPM_VERSION = '0.1.0';
export const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
export const FAILURE_OUTPUT_LINES = 20;

const ZAPBIP_NPX = `npx zapbip@${ZAPBIP_NPM_VERSION}`;

export function connectCommand(input: { connectionLink: string; client: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} connect --client ${input.client}`;
}

export function listenCommand(input: { connectionLink: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} listen`;
}
