import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PluginRegistry, type AgentPlugin, type HostedArtifact } from '../../libs/agents/src/contract';
import { AGENT_PLUGINS } from '../../libs/agents/src/plugins';
import { PRODUCTION_PUBLIC_ORIGIN } from '../../libs/types/src/constants';

const runCommand = promisify(execFile);
const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');
const SOURCE_DATE_EPOCH = '1767225600';
const TEMPORARY_PREFIX = 'zapbip-wheel-build-';
const NO_WHEEL_PLUGIN_MESSAGE = 'no self-hosted wheel plugin matches';
const RUNTIME_LOCK_FILE = 'requirements.txt';
const WHEEL_HASH_CONSTANT = 'WHEEL_SHA256';
const REQUIREMENTS_HASH_CONSTANT = 'REQUIREMENTS_SHA256';

type WheelPlugin = { id: string; plugin: AgentPlugin; wheel: HostedArtifact; requirements: HostedArtifact; buildRequirements: string };

function sha256Of(input: { bytes: Buffer | string }): string {
  return createHash('sha256').update(input.bytes).digest('hex');
}

async function buildWheel(input: { directory: string; wheelPlugin: WheelPlugin }): Promise<string> {
  const buildToolsDirectory = join(input.directory, 'build-tools');
  const wheelDirectory = join(input.directory, 'wheel');
  await runCommand('python3', [
    '-m',
    'pip',
    'install',
    '--require-hashes',
    '--target',
    buildToolsDirectory,
    '-r',
    join(REPOSITORY_ROOT, input.wheelPlugin.buildRequirements),
  ]);
  await runCommand(
    'python3',
    [
      '-m',
      'pip',
      'wheel',
      '--no-deps',
      '--no-build-isolation',
      '--wheel-dir',
      wheelDirectory,
      join(REPOSITORY_ROOT, input.wheelPlugin.plugin.packageFolder),
    ],
    {
      env: { ...process.env, PYTHONPATH: buildToolsDirectory, SOURCE_DATE_EPOCH },
    },
  );
  const [builtFilename, ...extraFilenames] = await readdir(wheelDirectory);
  if (builtFilename === undefined || extraFilenames.length > 0) throw new Error(`expected one wheel in ${wheelDirectory}`);
  return join(wheelDirectory, builtFilename);
}

function wheelPluginsOf(input: { requestedId: string | undefined }): WheelPlugin[] {
  return Object.entries(AGENT_PLUGINS)
    .filter(
      ([id, plugin]) => plugin.registry === PluginRegistry.SelfHostedWheel && (input.requestedId === undefined || input.requestedId === id),
    )
    .map(([id, plugin]) => {
      const wheel = plugin.hostedArtifacts.find((artifact) => !artifact.embeddedInInstallCommand);
      const requirements = plugin.hostedArtifacts.find((artifact) => artifact.embeddedInInstallCommand);
      if (wheel === undefined || requirements === undefined || plugin.buildRequirements === null)
        throw new Error(`${id} cannot be built as a wheel`);
      return { id, plugin, wheel, requirements, buildRequirements: plugin.buildRequirements };
    });
}

async function buildPlugin(input: { wheelPlugin: WheelPlugin }): Promise<string> {
  const { plugin, wheel, requirements } = input.wheelPlugin;
  const directory = await mkdtemp(join(tmpdir(), TEMPORARY_PREFIX));
  try {
    const builtWheel = await buildWheel({ directory, wheelPlugin: input.wheelPlugin });
    const releaseDirectory = join(REPOSITORY_ROOT, wheel.releaseFolder);
    const releaseWheel = join(releaseDirectory, wheel.filename);
    await copyFile(builtWheel, releaseWheel);
    const wheelHash = sha256Of({ bytes: await readFile(releaseWheel) });
    const wheelUrl = `${PRODUCTION_PUBLIC_ORIGIN}${wheel.path}`;
    const runtimeLock = await readFile(join(REPOSITORY_ROOT, plugin.packageFolder, RUNTIME_LOCK_FILE), 'utf8');
    const requirementsText = `${plugin.packageName} @ ${wheelUrl} \\\n    --hash=sha256:${wheelHash}\n${runtimeLock}`;
    const releaseRequirements = join(releaseDirectory, requirements.filename);
    await writeFile(releaseRequirements, requirementsText);
    return `${releaseWheel}\n${releaseRequirements}\nexport const ${WHEEL_HASH_CONSTANT} = '${wheelHash}';\nexport const ${REQUIREMENTS_HASH_CONSTANT} = '${sha256Of({ bytes: requirementsText })}';`;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const requestedId = process.argv[2];
  const wheelPlugins = wheelPluginsOf({ requestedId });
  if (wheelPlugins.length === 0) throw new Error(NO_WHEEL_PLUGIN_MESSAGE);
  const reports = await wheelPlugins.reduce<Promise<string[]>>(
    async (previous, wheelPlugin) => [...(await previous), await buildPlugin({ wheelPlugin })],
    Promise.resolve([]),
  );
  console.log(reports.join('\n'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
