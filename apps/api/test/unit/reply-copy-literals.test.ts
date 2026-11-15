import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
const REPLY_BUILDERS = [
  'libs/core/src/accounts/use-cases/account-reply.ts',
  'libs/core/src/accounts/use-cases/usage-reply.ts',
  'libs/core/src/accounts/use-cases/send-account-replies.ts',
  'libs/core/src/accounts/use-cases/apply-owner-command.ts',
  'libs/core/src/accounts/use-cases/describe-account.ts',
  'libs/core/src/accounts/use-cases/set-owner-language.ts',
  'libs/core/src/accounts/use-cases/issue-sign-in-link.ts',
  'libs/core/src/accounts/use-cases/install-prompt-reply.ts',
  'libs/core/src/accounts/use-cases/list-agent-connections.ts',
  'libs/core/src/accounts/use-cases/receive-account-message.ts',
  'libs/core/src/inbox/use-cases/notice-owner.ts',
  'libs/core/src/inbox/use-cases/send-notice.ts',
  'libs/core/src/inbox/use-cases/deliver-to-owner.ts',
  'libs/core/src/inbox/use-cases/owner-placement.ts',
  'libs/core/src/inbox/use-cases/routing-list.ts',
  'apps/api/src/adapters/whatsapp/outbound-builders.ts',
  'apps/api/src/numbers/number-notice.ts',
  'apps/api/src/inbound/owner-inbound.ts',
];
const LITERAL_PATTERN = /(['"`])((?:(?!\1)[^\n\\])*)\1/g;
const INTERPOLATION_PATTERN = /\$\{[^}]*\}/g;
const COMMENT_LINE_PATTERN = /^\s*(\/\/|\/\*|\*|import )/;
const CODE_ERROR_LINE_PATTERN = /throw |Error\(/;
const PROSE_PATTERN = /\s/;
const WORD_PATTERN = /\p{L}{2,}/u;

function proseLiteralsOf(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !COMMENT_LINE_PATTERN.test(line) && !CODE_ERROR_LINE_PATTERN.test(line))
    .flatMap((line) => [...line.matchAll(LITERAL_PATTERN)].map((match) => match[2]!.replace(INTERPOLATION_PATTERN, '')))
    .filter((literal) => PROSE_PATTERN.test(literal) && WORD_PATTERN.test(literal));
}

describe('the prose scanner', () => {
  it('finds a sentence written inline and ignores code, errors and interpolation', () => {
    const source = [
      "const text = 'Hello there';",
      "throw new Error('the command produced no reply');",
      'return `${folded} ${name}`;',
      "const kind = 'help';",
    ].join('\n');
    expect(proseLiteralsOf(source)).toEqual(['Hello there']);
  });
});

describe('the WhatsApp reply builders', () => {
  it.each(REPLY_BUILDERS)('builds %s only from copy', (path) => {
    expect(proseLiteralsOf(readFileSync(join(REPOSITORY_ROOT, path), 'utf8'))).toEqual([]);
  });
});
