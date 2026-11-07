import { INSTALL_SELF_TEST_TEXT, INSTALL_CODE_PREFIX, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENT_RULES } from './agent-rules';

const CONNECTION_SECRET_PREFIX = 'zb_conn_';

describe('agent rules', () => {
  test('pin: six lines naming the tools and the pending rule', () => {
    const lines = AGENT_RULES.split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain('check_inbox');
    expect(lines[1]).toContain('ask');
    expect(lines[1]).toContain('wait_for_reply');
    expect(lines[2]).toContain('WhatsApp');
    expect(lines[3]).toContain('sender "owner"');
    expect(lines[3]).toContain('verified true');
    expect(lines[4]).toContain('reply_to');
    expect(lines[5]).toContain('pending');
    expect(lines[5]).toContain('wait_for_reply');
  });

  test('pin: carries no secret', () => {
    expect(AGENT_RULES).not.toContain(CONNECTION_SECRET_PREFIX);
    expect(AGENT_RULES).not.toContain(INSTALL_CODE_PREFIX);
  });

  test('pin: self-test text per locale', () => {
    expect(INSTALL_SELF_TEST_TEXT[OwnerLocale.PortugueseBrazil]).toBe('✅ instalado');
    expect(INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs]).toBe('✅ installed');
  });
});
