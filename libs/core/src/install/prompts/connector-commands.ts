import { ZAPBIP_NPM_VERSION, ZAPBIP_PYPI_VERSION, type InstallClient } from '@zapbip/types';

export const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
export const FAILURE_OUTPUT_LINES = 20;

const ZAPBIP_NPX = `npx zapbip@${ZAPBIP_NPM_VERSION}`;

export const HERMES_INSTALL_COMMAND = `pip install zapbip-platform==${ZAPBIP_PYPI_VERSION}`;
export const OPENCLAW_INSTALL_COMMAND = `openclaw plugins install @zapbip/openclaw-plugin@${ZAPBIP_NPM_VERSION} --force --accept-capabilities`;

export function connectCommand(input: { connectionLink: string; client: InstallClient }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} connect --client ${input.client}`;
}

export function listenCommand(input: { connectionLink: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} listen`;
}
