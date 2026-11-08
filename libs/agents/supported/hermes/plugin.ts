import {
  hermesRequirementsPath,
  PRODUCTION_PUBLIC_ORIGIN,
  ZAPBIP_HERMES_PLUGIN_VERSION,
  ZAPBIP_HERMES_REQUIREMENTS_SHA256,
} from '@zapbip/types';

const REQUIREMENTS_URL = `${PRODUCTION_PUBLIC_ORIGIN}${hermesRequirementsPath({ version: ZAPBIP_HERMES_PLUGIN_VERSION })}`;
const DOWNLOADED_FILE = '"$d/zapbip-requirements.txt"';
const HASH_CHECK = `python3 -c 'import hashlib,sys; sys.exit(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest() != sys.argv[2])'`;

export const installCommand = `d=$(mktemp -d) && curl -fsSL ${REQUIREMENTS_URL} -o ${DOWNLOADED_FILE} && ${HASH_CHECK} ${DOWNLOADED_FILE} ${ZAPBIP_HERMES_REQUIREMENTS_SHA256} && python3 -m pip install --only-binary=:all: --require-hashes -r ${DOWNLOADED_FILE}`;
