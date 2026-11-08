import { existsSync, readFileSync } from 'node:fs';
import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { PluginRegistry } from '@zapbip/agents';
import { ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = '../..';
const PLUGIN_MANIFEST = 'package.json';

function expectedVersion(input: { packageFolder: string }): string {
  const manifestPath = `${REPOSITORY_ROOT}/${input.packageFolder}/${PLUGIN_MANIFEST}`;
  if (!existsSync(manifestPath)) return ZAPBIP_NPM_VERSION;
  return (JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string }).version;
}

describe('npm plugin versions', () => {
  it.each(Object.values(AGENT_PLUGINS).filter((plugin) => plugin.registry === PluginRegistry.Npm))(
    '$packageName matches its package when it exists, and the connector version until it lands',
    (plugin) => {
      expect(plugin.version).toBe(expectedVersion({ packageFolder: plugin.packageFolder }));
    },
  );
});
