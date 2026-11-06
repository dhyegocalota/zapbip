import { describe, expect, it } from 'vitest';
import { redactInstallCodes } from '../../src/account-inbox/install-code-redaction';

const REAL_CODE = 'A'.repeat(22);
const MASKED_CODE = '*'.repeat(22);
const LINK_PREFIX = 'https://zapbip.test/i/zb_inst_';
const SELECT_PREFIX = 'SELECT';
const UPDATE_PREFIX = 'UPDATE';

function fakeStorage(input: { payloads: Record<string, string> }) {
  const payloads = new Map(Object.entries(input.payloads));
  const statements: string[] = [];
  const storage = {
    sql: {
      exec: (statement: string, ...bindings: string[]) => {
        statements.push(statement);
        if (statement.startsWith(SELECT_PREFIX)) {
          const [id] = bindings;
          const payload = payloads.get(id!);
          return { toArray: () => (payload === undefined ? [] : [{ id, payload }]) };
        }
        const [payload, id] = bindings;
        payloads.set(id!, payload!);
        return { toArray: () => [] };
      },
    },
  } as unknown as DurableObjectStorage;
  return { storage, payloads, statements };
}

describe('redactInstallCodes', () => {
  it('masks the install code of the given messages only', () => {
    const { storage, payloads } = fakeStorage({
      payloads: { msg_sent: `open ${LINK_PREFIX}${REAL_CODE}`, msg_other: `open ${LINK_PREFIX}${REAL_CODE}` },
    });
    redactInstallCodes({ storage, messageIds: ['msg_sent'] });
    expect(payloads.get('msg_sent')).toBe(`open ${LINK_PREFIX}${MASKED_CODE}`);
    expect(payloads.get('msg_other')).toBe(`open ${LINK_PREFIX}${REAL_CODE}`);
  });

  it('does not rewrite a message that is already masked', () => {
    const { storage, statements } = fakeStorage({ payloads: { msg_masked: `open ${LINK_PREFIX}${MASKED_CODE}` } });
    redactInstallCodes({ storage, messageIds: ['msg_masked'] });
    expect(statements.filter((statement) => statement.startsWith(UPDATE_PREFIX))).toEqual([]);
  });

  it('never scans the message log', () => {
    const { storage, statements } = fakeStorage({ payloads: { msg_sent: `open ${LINK_PREFIX}${REAL_CODE}` } });
    redactInstallCodes({ storage, messageIds: ['msg_sent'] });
    expect(statements.filter((statement) => statement.includes('LIKE'))).toEqual([]);
  });

  it('touches nothing when no message was sent', () => {
    const { storage, statements } = fakeStorage({ payloads: {} });
    redactInstallCodes({ storage, messageIds: [] });
    expect(statements).toEqual([]);
  });
});
