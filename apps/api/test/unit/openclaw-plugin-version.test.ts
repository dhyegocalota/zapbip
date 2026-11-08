import { existsSync, readFileSync } from 'node:fs';
import { AGENT_PLUGINS, PluginAgent } from '@zapbip/agents/plugins';
import { ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, it } from 'vitest';

const PLUGIN_PACKAGE_PATH = '../openclaw-plugin/package.json';

function expectedVersion(): string {
  if (!existsSync(PLUGIN_PACKAGE_PATH)) return ZAPBIP_NPM_VERSION;
  return (JSON.parse(readFileSync(PLUGIN_PACKAGE_PATH, 'utf8')) as { version: string }).version;
}

describe('openclaw plugin version', () => {
  it('matches the plugin package when it exists, and the connector version until it lands', () => {
    expect(AGENT_PLUGINS[PluginAgent.OpenClaw].version).toBe(expectedVersion());
  });
});
