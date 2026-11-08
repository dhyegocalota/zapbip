import { ZAPBIP_NPM_VERSION } from '@zapbip/types';

export const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
export const FAILURE_OUTPUT_LINES = 20;

export const ZAPBIP_NPX = `npx zapbip@${ZAPBIP_NPM_VERSION}`;

export function listenCommand(input: { connectionLink: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} listen`;
}
