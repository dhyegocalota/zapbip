import { describe, expect, test } from 'vitest';
import { definition } from '../testing/fixture-agent/definition';
import { treeLeakViolationsOf } from './leak-scan';

const AGENTS = [{ id: 'fixture-agent', definition: { ...definition, idIsOrdinaryWord: false }, runtime: null, wake: null, channel: null }];

const WAKE_TARGET = {
  providerId: 'fixture_routine',
  host: 'routines.fixture-agent.example',
  exampleUrl: 'https://routines.fixture-agent.example/fire/abcdefgh12',
  pathPattern: /^\/fire\/[a-z0-9]+$/,
  buildHeaders: () => ({}),
};
const CHANNEL = { capability: 'fixture/channel', notificationMethod: 'notifications/fixture/channel' };

describe('treeLeakViolationsOf', () => {
  test.each(['js', 'cjs', 'cts', 'jsx', 'yaml', 'toml'])('scans a .%s file', (extension) => {
    const path = `tools/example.${extension}`;
    expect(treeLeakViolationsOf({ agents: AGENTS, files: [{ path, text: 'fixture-agent' }] })).toEqual([`${path}:1 names fixture-agent`]);
  });

  test('reports the wake host and provider id of an agent named outside its folder', () => {
    const agents = [{ ...AGENTS[0]!, wake: WAKE_TARGET }];
    const files = [{ path: 'apps/api/src/wake.ts', text: "const host = 'routines.fixture-agent.example';\nconst id = 'fixture_routine';" }];
    expect(treeLeakViolationsOf({ agents, files })).toEqual([
      'apps/api/src/wake.ts:1 names fixture-agent',
      'apps/api/src/wake.ts:2 names fixture-agent',
    ]);
  });

  test('reports the channel capability and notification method of an agent named outside its folder', () => {
    const agents = [{ ...AGENTS[0]!, channel: CHANNEL }];
    const files = [
      {
        path: 'apps/connector/src/channel.ts',
        text: "const capability = 'fixture/channel';\nconst method = 'notifications/fixture/channel';",
      },
    ];
    expect(treeLeakViolationsOf({ agents, files })).toHaveLength(2);
  });

  test('accepts the same literals inside the folder of the agent', () => {
    const agents = [{ ...AGENTS[0]!, wake: WAKE_TARGET, channel: CHANNEL }];
    const files = [{ path: 'libs/agents/supported/fixture-agent/wake.ts', text: "const host = 'routines.fixture-agent.example';" }];
    expect(treeLeakViolationsOf({ agents, files })).toEqual([]);
  });
});
