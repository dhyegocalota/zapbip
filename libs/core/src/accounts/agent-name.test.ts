import { describe, expect, test } from 'vitest';
import { AGENT_NAME_MAX_CHARS } from '../inbox/constants';
import { isReservedAgentName, normalizeAgentName } from './agent-name';

describe('normalizeAgentName', () => {
  test.each([
    ['Claude Code', 'claude-code'],
    ['Ação', 'acao'],
    ['  -x-  ', 'x'],
    ['a___b', 'a-b'],
    ['Ajuda', 'ajuda'],
    ['1agent', '1agent'],
    ['-agent', 'agent'],
  ])('turns %j into %j', (rawName, name) => {
    expect(normalizeAgentName({ rawName })).toBe(name);
  });

  test.each(['!!!', '   ', ''])('rejects %j as empty after normalisation', (rawName) => {
    expect(normalizeAgentName({ rawName })).toBeNull();
  });

  test('keeps a name of exactly the maximum length', () => {
    const rawName = 'a'.repeat(AGENT_NAME_MAX_CHARS);
    expect(normalizeAgentName({ rawName })).toBe(rawName);
  });

  test('rejects a name one character over the maximum', () => {
    expect(normalizeAgentName({ rawName: 'a'.repeat(AGENT_NAME_MAX_CHARS + 1) })).toBeNull();
  });
});

describe('isReservedAgentName', () => {
  test.each(['novo', 'new', 'agentes', 'agents', 'revogar', 'revoke', 'girar', 'rotate', 'ajuda', 'help', 'menu', 'apagar', 'delete'])(
    'reserves %s',
    (name) => {
      expect(isReservedAgentName({ name })).toBe(true);
    },
  );

  test.each(['claude-code', 'agente', 'conta', 'account'])('allows %s', (name) => {
    expect(isReservedAgentName({ name })).toBe(false);
  });
});
