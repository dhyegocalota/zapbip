import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_CREATED_AT } from '../support/seed';
import { applyDirectoryMigrationWithNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { failNextSessionSend } from '../support/session-send-probe';
import { bindingsWith, deliver, findAccounts, WA_ID } from './owner-inbound-fixtures';

const BLOCKED_PHONE = '5511900000077';
const LIMITED_PHONE = '5511900000078';
const ALLOWED_BEFORE_LIMIT = 1;
const AGENT_NAME = 'claude-redaction';
const FORBIDDEN_PATTERNS = [/zb_conn_/, /zb_inst_/, /[0-9a-f]{64}/, /novo agente/, /apagar conta/];

describe('logs over the owner walk', () => {
  beforeEach(applyDirectoryMigrationWithNumber);
  afterEach(() => {
    vi.restoreAllMocks();
    return reset();
  });

  it('[row 416][row 453][row 577] never carry a secret, an install code, a digest, a phone, an agent name or message text', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    await testEnv.CONNECTIONS.prepare('INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES (?, ?, ?)')
      .bind(BLOCKED_PHONE, 'abuse', SEED_CREATED_AT)
      .run();
    const bindings = bindingsWith({ waitlistEnabled: false });
    const limited = bindingsWith({ waitlistEnabled: false, ownerLimit: ALLOWED_BEFORE_LIMIT });
    await deliver({ bindings, text: 'oi' });
    await deliver({ bindings, text: `novo agente ${AGENT_NAME}` });
    await deliver({ bindings, text: 'agentes' });
    await deliver({ bindings, text: `renovar ${AGENT_NAME}` });
    const [account] = await findAccounts({ waId: WA_ID });
    if (account === undefined) throw new Error('account is missing');
    await failNextSessionSend({ accountId: account.accountId });
    await deliver({ bindings, text: `renovar ${AGENT_NAME}` });
    await deliver({ bindings, text: `revogar ${AGENT_NAME}` });
    await deliver({ bindings, waId: BLOCKED_PHONE, text: 'oi' });
    await deliver({ bindings: limited, waId: LIMITED_PHONE, text: 'oi' });
    await deliver({ bindings: limited, waId: LIMITED_PHONE, text: 'oi' });
    await deliver({ bindings, text: 'apagar conta' });
    await deliver({ bindings, text: 'apagar conta definitivamente' });
    const output = lines.join('\n');
    expect(output.length).toBeGreaterThan(0);
    FORBIDDEN_PATTERNS.forEach((pattern) => expect(output).not.toMatch(pattern));
    [WA_ID, BLOCKED_PHONE, LIMITED_PHONE, AGENT_NAME].forEach((value) => expect(output).not.toContain(value));
  });

  it('logs the blocked sender once by event name', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    await testEnv.CONNECTIONS.prepare('INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES (?, ?, ?)')
      .bind(BLOCKED_PHONE, 'abuse', SEED_CREATED_AT)
      .run();
    await deliver({ bindings: bindingsWith({ waitlistEnabled: false }), waId: BLOCKED_PHONE, text: 'oi' });
    expect(lines.filter((line) => line.includes('sender_blocked'))).toHaveLength(1);
  });
});
