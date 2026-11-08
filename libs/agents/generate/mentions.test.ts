import { describe, expect, test } from 'vitest';
import { mentionsOf } from './mentions';

const NAMES = ['Demo Agent', 'Agente Demo', 'demo-agent'];

describe('mentionsOf', () => {
  test('lists the file and line of every mention, in either language, ignoring case', () => {
    const files = [
      { path: 'apps/docs/index.mdx', text: 'Intro\nAsk Demo Agent to send it.' },
      { path: 'apps/docs/pt-br/index.mdx', text: 'Peça ao agente demo para enviar.\nPeça ao AGENTE DEMO.' },
    ];
    expect(mentionsOf({ names: NAMES, files, excludedPrefixes: [] })).toEqual(['apps/docs/index.mdx:2', 'apps/docs/pt-br/index.mdx:2']);
  });

  test('skips the excluded prefixes', () => {
    const files = [
      { path: 'libs/agents/supported/demo-agent/page.en.mdx', text: 'Demo Agent' },
      { path: 'apps/docs/index.mdx', text: 'Demo Agent' },
    ];
    expect(mentionsOf({ names: NAMES, files, excludedPrefixes: ['libs/agents/supported/demo-agent/'] })).toEqual(['apps/docs/index.mdx:1']);
  });

  test('reads a name literally, not as a pattern', () => {
    const files = [{ path: 'a.md', text: 'C++ (beta)\nCxx beta' }];
    expect(mentionsOf({ names: ['C++ (beta)'], files, excludedPrefixes: [] })).toEqual(['a.md:1']);
  });

  test('does not match inside a longer word', () => {
    const files = [{ path: 'a.md', text: 'a database cursor\nCursor rules' }];
    expect(mentionsOf({ names: ['Cursor'], files, excludedPrefixes: [] })).toEqual(['a.md:2']);
  });

  test('lists nothing when nothing mentions the agent', () => {
    expect(mentionsOf({ names: NAMES, files: [{ path: 'a.md', text: 'nothing' }], excludedPrefixes: [] })).toEqual([]);
  });
});
