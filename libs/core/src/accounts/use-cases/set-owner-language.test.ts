import { AccountReplyIntent, CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AccountCommand } from '../account-types';
import { renderAccountReply } from '../account-copy';
import { createAccountFixture, ownerInputOf } from '../testing/fixtures';
import { applyOwnerCommand } from './apply-owner-command';

function languageCommand(input: { rawName: string | null; locale: OwnerLocale }): AccountCommand {
  return { kind: CommandKind.SetLanguage, rawName: input.rawName, locale: input.locale };
}

async function apply(input: { command: AccountCommand; locale?: OwnerLocale }) {
  const fixture = await createAccountFixture({ locale: input.locale });
  const result = await applyOwnerCommand({ ...ownerInputOf(fixture), command: input.command, isRequestLive: false });
  const stored = await fixture.environment.dependencies.accounts.findById({ accountId: fixture.account.accountId });
  return { fixture, result, stored };
}

describe('the language command', () => {
  test.each(Object.values(OwnerLocale))('changes the stored language to %s and answers in it', async (locale) => {
    const { result, stored } = await apply({
      command: languageCommand({ rawName: locale.toLowerCase().replace('_', '-'), locale: OwnerLocale.EnglishUs }),
      locale: locale === OwnerLocale.Japanese ? OwnerLocale.Korean : OwnerLocale.Japanese,
    });
    const [reply] = result.replies;
    expect(stored!.locale).toBe(locale);
    expect(reply!.intent).toBe(AccountReplyIntent.LanguageChanged);
    expect(reply!.locale).toBe(locale);
    expect(renderAccountReply({ reply: reply! }).length).toBeGreaterThan(0);
  });

  test('keeps the stored language and lists the codes when the code is unknown', async () => {
    const { result, stored, fixture } = await apply({
      command: languageCommand({ rawName: 'klingon', locale: OwnerLocale.EnglishUs }),
      locale: OwnerLocale.German,
    });
    const [reply] = result.replies;
    expect(stored!.locale).toBe(OwnerLocale.German);
    expect(fixture.account.locale).toBe(OwnerLocale.German);
    expect(reply!.intent).toBe(AccountReplyIntent.LanguageUnknown);
    expect(reply!.locale).toBe(OwnerLocale.EnglishUs);
    expect(renderAccountReply({ reply: reply! })).toContain('zh');
  });

  test('keeps the stored language and lists the codes when no code is given', async () => {
    const { result, stored } = await apply({
      command: languageCommand({ rawName: '', locale: OwnerLocale.Spanish }),
      locale: OwnerLocale.French,
    });
    expect(stored!.locale).toBe(OwnerLocale.French);
    expect(result.replies[0]!.intent).toBe(AccountReplyIntent.LanguageUnknown);
  });
});
