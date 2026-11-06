import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { createGenericInstallPromptRenderer } from '../../src/adapters/prompt/generic-install-prompt';

const CONNECTION_LINK = 'https://zapbip.example/c/zb_conn_secret/mcp';
const NULL_TEXT = 'null';
const UNDEFINED_TEXT = 'undefined';
const PASSWORD_WORDS: Record<OwnerLocale, RegExp> = {
  [OwnerLocale.EnglishUs]: /password/i,
  [OwnerLocale.PortugueseBrazil]: /senha/i,
};

function render(input: { locale: OwnerLocale }): Promise<string> {
  return createGenericInstallPromptRenderer().render({ accountId: 'acc_1', agent: 'claude', connectionLink: CONNECTION_LINK, ...input });
}

describe('generic install prompt', () => {
  it.each(Object.values(OwnerLocale))('contains the link once, the password warning and no placeholder text in %s', async (locale) => {
    const prompt = await render({ locale });
    expect(prompt.split(CONNECTION_LINK)).toHaveLength(2);
    expect(prompt).toMatch(PASSWORD_WORDS[locale]);
    expect(prompt).not.toContain(NULL_TEXT);
    expect(prompt).not.toContain(UNDEFINED_TEXT);
  });

  it('names the agent', async () => {
    expect(await render({ locale: OwnerLocale.EnglishUs })).toContain('claude');
  });

  it('keeps the link on a line of its own', async () => {
    const lines = (await render({ locale: OwnerLocale.EnglishUs })).split('\n');
    expect(lines).toContain(CONNECTION_LINK);
  });
});
