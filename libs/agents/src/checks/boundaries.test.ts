import { describe, expect, test } from 'vitest';
import { boundaryViolationsOf } from './boundaries';

function violationsFor(input: { path: string; text: string }): string[] {
  return boundaryViolationsOf({ files: [input] });
}

describe('boundaryViolationsOf', () => {
  test.each(['libs/core/src/install/index.ts', 'libs/types/src/enums.ts'])('B1: %s imports nothing from the agents package', (path) => {
    expect(violationsFor({ path, text: "import { AgentId } from '@zapbip/agents/definitions';" })).toEqual([
      `${path}: B1 the shared libraries import no agents package (@zapbip/agents/definitions)`,
    ]);
  });

  test('B1: accepts a type-only package that is not the agents package', () => {
    expect(violationsFor({ path: 'libs/core/src/a.ts', text: "import { X } from '@zapbip/types';" })).toEqual([]);
  });

  test('B2: an agent folder imports no other agent folder', () => {
    const path = 'libs/agents/supported/alpha/install.ts';
    expect(violationsFor({ path, text: "import { definition } from '../beta/definition';" })).toEqual([
      `${path}: B2 an agent folder imports no other agent folder or app (../beta/definition)`,
    ]);
  });

  test('B2: an agent folder imports no app', () => {
    const path = 'libs/agents/supported/alpha/plugin.ts';
    expect(violationsFor({ path, text: "import { run } from '../../../../apps/alpha-plugin/run';" })).toEqual([
      `${path}: B2 an agent folder imports no other agent folder or app (../../../../apps/alpha-plugin/run)`,
    ]);
  });

  test('B2: an agent folder may import its own files, the shared source and the testing helpers', () => {
    const text = [
      "import { wheel } from './wheel';",
      "import { versionPinOf } from '../../src/version-pin';",
      "import { sectionInput } from '../../testing/install-fixtures';",
    ].join('\n');
    expect(violationsFor({ path: 'libs/agents/supported/alpha/plugin.ts', text })).toEqual([]);
  });

  test.each(['definition.ts', 'install.ts', 'install-copy.ts', 'plugin.ts'])('B3: %s imports no node module', (file) => {
    const path = `libs/agents/supported/alpha/${file}`;
    expect(violationsFor({ path, text: "import { readFileSync } from 'node:fs';" })).toEqual([
      `${path}: B3 this facet runs in the Worker and imports no node module (node:fs)`,
    ]);
  });

  test('B3: other files of an agent folder may import node modules', () => {
    expect(violationsFor({ path: 'libs/agents/supported/alpha/connector.ts', text: "import { join } from 'node:path';" })).toEqual([]);
  });

  test.each(['@zapbip/agents', '@zapbip/agents/docs', '@zapbip/agents/definitions', '@zapbip/agents/connector'])(
    'B4: the Worker source does not import %s',
    (specifier) => {
      const path = 'apps/api/src/routes/example.ts';
      expect(violationsFor({ path, text: `import { x } from '${specifier}';` })).toEqual([
        `${path}: B4 the Worker imports only the install, plugins and wake facets (${specifier})`,
      ]);
    },
  );

  test.each(['@zapbip/agents/install', '@zapbip/agents/plugins'])('B4: the Worker source may import %s', (specifier) => {
    expect(violationsFor({ path: 'apps/api/src/routes/example.ts', text: `import { x } from '${specifier}';` })).toEqual([]);
  });

  test('B4: scripts and tests of the API are not the Worker source', () => {
    expect(violationsFor({ path: 'apps/api/scripts/deploy.ts', text: "import type { A } from '@zapbip/agents';" })).toEqual([]);
  });

  test.each(['AgentId', 'InstallClient', 'ConnectorClient', 'DocsOnlyClient', 'ChannelPluginProduct'])(
    'B7: libs/types declares no %s',
    (enumName) => {
      const path = 'libs/types/src/enums.ts';
      expect(violationsFor({ path, text: `export enum ${enumName} {\n  X = 'x',\n}` })).toEqual([
        `${path}: B7 the shared types declare no agent enum (${enumName})`,
      ]);
    },
  );

  test('reads dynamic imports and re-exports too', () => {
    const text = "export * from '@zapbip/agents/docs';\nconst module = await import('@zapbip/agents/connector');";
    expect(violationsFor({ path: 'apps/api/src/a.ts', text })).toHaveLength(2);
  });

  test('B4: a bare side-effect import of a forbidden facet in the Worker source is refused', () => {
    const path = 'apps/api/src/routes/install-page.ts';
    expect(violationsFor({ path, text: "import '@zapbip/agents/docs';" })).toEqual([expect.stringContaining('(@zapbip/agents/docs)')]);
  });

  test('B3: a bare side-effect import of a node module in an agent folder is refused', () => {
    const path = 'libs/agents/supported/alpha/install.ts';
    expect(violationsFor({ path, text: "import 'node:fs';" })).toEqual([expect.stringContaining('(node:fs)')]);
  });
});
