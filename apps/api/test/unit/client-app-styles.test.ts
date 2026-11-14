import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLESHEET = readFileSync(join(import.meta.dirname, '../../src/client-app/assets/client-app.css'), 'utf8');
const CONNECT_LABEL_RULE_PATTERN = /\n\.connect-form label \{[^}]*\}/;

describe('client app stylesheet', () => {
  it('leaves a space token between the connect label and its input', () => {
    expect(STYLESHEET.match(CONNECT_LABEL_RULE_PATTERN)?.[0]).toContain('margin-bottom: var(--space-2);');
  });
});
