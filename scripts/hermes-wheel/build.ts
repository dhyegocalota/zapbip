import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PRODUCTION_PUBLIC_ORIGIN, ZAPBIP_HERMES_PLUGIN_VERSION } from '../../libs/types/src/constants';
import { hermesRequirementsFilename, hermesWheelFilename, hermesWheelPath } from '../../libs/types/src/hermes-wheel';

const runCommand = promisify(execFile);
const PLUGIN_DIRECTORY = join(import.meta.dirname, '..', '..', 'apps', 'hermes-plugin');
const RELEASE_DIRECTORY = join(PLUGIN_DIRECTORY, 'release');
const BUILD_REQUIREMENTS = join(import.meta.dirname, '..', 'e2e', 'clients', 'hermes', 'build-requirements.txt');
const SOURCE_DATE_EPOCH = '1767225600';
const TEMPORARY_PREFIX = 'zapbip-wheel-build-';
const RUNTIME_LOCK = join(PLUGIN_DIRECTORY, 'requirements.txt');
const HASH_CONSTANT = 'ZAPBIP_HERMES_WHEEL_SHA256';
const REQUIREMENTS_HASH_CONSTANT = 'ZAPBIP_HERMES_REQUIREMENTS_SHA256';

function sha256Of(input: { bytes: Buffer | string }): string {
  return createHash('sha256').update(input.bytes).digest('hex');
}

async function buildWheel(input: { directory: string }): Promise<string> {
  const buildToolsDirectory = join(input.directory, 'build-tools');
  const wheelDirectory = join(input.directory, 'wheel');
  await runCommand('python3', ['-m', 'pip', 'install', '--require-hashes', '--target', buildToolsDirectory, '-r', BUILD_REQUIREMENTS]);
  await runCommand(
    'python3',
    ['-m', 'pip', 'wheel', '--no-deps', '--no-build-isolation', '--wheel-dir', wheelDirectory, PLUGIN_DIRECTORY],
    {
      env: { ...process.env, PYTHONPATH: buildToolsDirectory, SOURCE_DATE_EPOCH },
    },
  );
  const [builtFilename, ...extraFilenames] = await readdir(wheelDirectory);
  if (builtFilename === undefined || extraFilenames.length > 0) throw new Error(`expected one wheel in ${wheelDirectory}`);
  return join(wheelDirectory, builtFilename);
}

async function main(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), TEMPORARY_PREFIX));
  try {
    const builtWheel = await buildWheel({ directory });
    const filename = hermesWheelFilename({ version: ZAPBIP_HERMES_PLUGIN_VERSION });
    const releaseWheel = join(RELEASE_DIRECTORY, filename);
    await copyFile(builtWheel, releaseWheel);
    const wheelHash = sha256Of({ bytes: await readFile(releaseWheel) });
    const wheelUrl = `${PRODUCTION_PUBLIC_ORIGIN}${hermesWheelPath({ version: ZAPBIP_HERMES_PLUGIN_VERSION })}`;
    const requirements = `zapbip-platform @ ${wheelUrl} \\\n    --hash=sha256:${wheelHash}\n${await readFile(RUNTIME_LOCK, 'utf8')}`;
    const releaseRequirements = join(RELEASE_DIRECTORY, hermesRequirementsFilename({ version: ZAPBIP_HERMES_PLUGIN_VERSION }));
    await writeFile(releaseRequirements, requirements);
    console.log(
      `${releaseWheel}\n${releaseRequirements}\nexport const ${HASH_CONSTANT} = '${wheelHash}';\nexport const ${REQUIREMENTS_HASH_CONSTANT} = '${sha256Of({ bytes: requirements })}';`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
