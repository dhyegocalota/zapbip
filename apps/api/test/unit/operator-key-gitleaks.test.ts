import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createOperatorKey } from '../../src/backoffice/operator-mcp/operator-key';
import {
  OPERATOR_KEY_ID_BYTES,
  OPERATOR_KEY_ID_PATTERN,
  OPERATOR_KEY_PREFIX,
  OPERATOR_KEY_SECRET_BYTES,
  OPERATOR_KEY_SECRET_PATTERN,
} from '../../src/backoffice/operator-mcp/operator-mcp-constants';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';

const GITLEAKS_CONFIGURATION = join(import.meta.dirname, '..', '..', '..', '..', '.gitleaks.toml');
const RULE_PATTERN = /\[\[rules\]\]\s+id = "zapbip-operator-key"[^[]*?regex = '''([^']+)'''/;

function operatorKeyRegex(): RegExp {
  const match = RULE_PATTERN.exec(readFileSync(GITLEAKS_CONFIGURATION, 'utf8'));
  if (match === null || match[1] === undefined) throw new Error('the gitleaks configuration has no operator key rule');
  return new RegExp(match[1]);
}

describe('the gitleaks rule for operator keys', () => {
  it('spells the same key shape as the key module', () => {
    expect(operatorKeyRegex().source).toBe(`${OPERATOR_KEY_PREFIX}${OPERATOR_KEY_ID_PATTERN}_${OPERATOR_KEY_SECRET_PATTERN}`);
  });

  it('reports a freshly created key, also inside a quoted assignment', () => {
    const { key } = createOperatorKey({
      idBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_ID_BYTES)),
      secretBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_SECRET_BYTES)),
    });
    expect(operatorKeyRegex().test(key)).toBe(true);
    expect(operatorKeyRegex().test(`AUTHORIZATION="Bearer ${key}"`)).toBe(true);
  });

  it('stays silent on a product connection secret', () => {
    expect(operatorKeyRegex().test(`${CONNECTION_SECRET_PREFIX}${'A'.repeat(43)}`)).toBe(false);
  });
});
