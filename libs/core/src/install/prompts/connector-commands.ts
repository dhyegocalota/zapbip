import {
  hermesWheelPath,
  type InstallClient,
  PRODUCTION_PUBLIC_ORIGIN,
  ZAPBIP_HERMES_PLUGIN_VERSION,
  ZAPBIP_HERMES_WHEEL_SHA256,
  ZAPBIP_NPM_VERSION,
} from '@zapbip/types';

export const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
export const FAILURE_OUTPUT_LINES = 20;

const ZAPBIP_NPX = `npx zapbip@${ZAPBIP_NPM_VERSION}`;

const HERMES_WHEEL_URL = `${PRODUCTION_PUBLIC_ORIGIN}${hermesWheelPath({ version: ZAPBIP_HERMES_PLUGIN_VERSION })}#sha256=${ZAPBIP_HERMES_WHEEL_SHA256}`;

export const HERMES_INSTALL_COMMAND = `pip install "zapbip-platform @ ${HERMES_WHEEL_URL}"`;
export const OPENCLAW_INSTALL_COMMAND = `openclaw plugins install @zapbip/openclaw-plugin@${ZAPBIP_NPM_VERSION} --force --accept-capabilities`;

export function connectCommand(input: { connectionLink: string; client: InstallClient }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} connect --client ${input.client}`;
}

export function listenCommand(input: { connectionLink: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} listen`;
}
