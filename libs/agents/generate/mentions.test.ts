import { describe, expect, test } from 'vitest';
import { mentionsOf } from './mentions';

const NAMES = ['Probe Zq Agent', 'Agente Probe Zq', 'probe-zq-agent'];

describe('mentionsOf', () => {
  test('lists the file and line of every mention, in either language, ignoring case', () => {
    const files = [
      { path: 'apps/docs/index.mdx', text: 'Intro\nAsk Probe Zq Agent to send it.' },
      { path: 'apps/docs/pt-br/index.mdx', text: 'Peça ao agente probe zq para enviar.\nPeça ao AGENTE PROBE ZQ.' },
    ];
    expect(mentionsOf({ names: NAMES, files, excludedPrefixes: [] })).toEqual([
      'apps/docs/index.mdx:2',
      'apps/docs/pt-br/index.mdx:1',
      'apps/docs/pt-br/index.mdx:2',
    ]);
  });

  test('skips the excluded prefixes', () => {
    const files = [
      { path: 'libs/agents/supported/probe-zq-agent/page.en.mdx', text: 'Probe Zq Agent' },
      { path: 'apps/docs/index.mdx', text: 'Probe Zq Agent' },
    ];
    expect(mentionsOf({ names: NAMES, files, excludedPrefixes: ['libs/agents/supported/probe-zq-agent/'] })).toEqual([
      'apps/docs/index.mdx:1',
    ]);
  });

  test('reads a name literally, not as a pattern', () => {
    const files = [{ path: 'a.md', text: 'C++ (beta)\nCxx beta' }];
    expect(mentionsOf({ names: ['C++ (beta)'], files, excludedPrefixes: [] })).toEqual(['a.md:1']);
  });

  test('does not match inside a longer word', () => {
    const files = [{ path: 'a.md', text: 'Widgets everywhere\nWidget rules' }];
    expect(mentionsOf({ names: ['Widget'], files, excludedPrefixes: [] })).toEqual(['a.md:2']);
  });

  test('lists nothing when nothing mentions the agent', () => {
    expect(mentionsOf({ names: NAMES, files: [{ path: 'a.md', text: 'nothing' }], excludedPrefixes: [] })).toEqual([]);
  });
});
