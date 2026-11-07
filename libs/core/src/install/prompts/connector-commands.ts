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
const HERMES_DOWNLOADED_FILE = '"$d/zapbip-requirements.txt"';
const HERMES_HASH_CHECK = `python3 -c 'import hashlib,sys; sys.exit(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest() != sys.argv[2])'`;

export const HERMES_INSTALL_COMMAND = `d=$(mktemp -d) && curl -fsSL ${HERMES_REQUIREMENTS_URL} -o ${HERMES_DOWNLOADED_FILE} && ${HERMES_HASH_CHECK} ${HERMES_DOWNLOADED_FILE} ${ZAPBIP_HERMES_REQUIREMENTS_SHA256} && python3 -m pip install --only-binary=:all: --require-hashes -r ${HERMES_DOWNLOADED_FILE}`;
export const OPENCLAW_INSTALL_COMMAND = `openclaw plugins install @zapbip/openclaw-plugin@${ZAPBIP_NPM_VERSION} --force --accept-capabilities`;

export function connectCommand(input: { connectionLink: string; client: InstallClient }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} connect --client ${input.client}`;
}

export function listenCommand(input: { connectionLink: string }): string {
  return `${CONNECTION_URL_VARIABLE}=${input.connectionLink} ${ZAPBIP_NPX} listen`;
}
