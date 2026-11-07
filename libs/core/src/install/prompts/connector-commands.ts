import {
  hermesRequirementsPath,
  type InstallClient,
  PRODUCTION_PUBLIC_ORIGIN,
  ZAPBIP_HERMES_PLUGIN_VERSION,
  ZAPBIP_HERMES_REQUIREMENTS_SHA256,
  ZAPBIP_NPM_VERSION,
} from '@zapbip/types';

export const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
export const FAILURE_OUTPUT_LINES = 20;

const ZAPBIP_NPX = `npx zapbip@${ZAPBIP_NPM_VERSION}`;

const HERMES_REQUIREMENTS_URL = `${PRODUCTION_PUBLIC_ORIGIN}${hermesRequirementsPath({ version: ZAPBIP_HERMES_PLUGIN_VERSION })}`;
const HERMES_REQUIREMENTS_FILE = 'zapbip-requirements.txt';

export const HERMES_INSTALL_COMMAND = `curl -fsSL ${HERMES_REQUIREMENTS_URL} -o ${HERMES_REQUIREMENTS_FILE} && echo "${ZAPBIP_HERMES_REQUIREMENTS_SHA256}  ${HERMES_REQUIREMENTS_FILE}" | sha256sum -c - && pip install --require-hashes -r ${HERMES_REQUIREMENTS_FILE}`;
export const OPENCLAW_INSTALL_COMMAND = `openclaw plugins install @zapbip/openclaw-plugin@${ZAPBIP_NPM_VERSION} --force --accept-capabilities`;

export function connectCommand(input: { connectionLink: string; client: InstallClient }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} connect --client ${input.client}`;
}

export function listenCommand(input: { connectionLink: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} listen`;
}
