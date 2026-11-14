import { COMMAND_WORDS } from '@zapbip/core';
import { CommandKind, INSTALL_SELF_TEST_TEXT, type OwnerLocale } from '@zapbip/types';
import { heading, HeadingLevel, list, type MarkdownBlock, MarkdownBlockKind, paragraph, renderMarkdown } from './markdown-document';
import { quickStartEntriesOf } from './quick-start-entries';
import { SETUP_CONNECTION_PLACEHOLDER } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import { startLinkOf } from './site-links';

function createAgentWordsOf(input: { ownerLocale: OwnerLocale }): string {
  const command = COMMAND_WORDS.find((entry) => entry.kind === CommandKind.CreateAgent && entry.locale === input.ownerLocale);
  if (command === undefined) throw new Error(`no create-agent words for ${input.ownerLocale}`);
  return command.words;
}

export function setupMarkdownOf(input: { locale: OwnerLocale; origin: string }): string {
  const { locale, origin } = input;
  const translate = copyOf({ locale });
  const command = `${createAgentWordsOf({ ownerLocale: locale })} <${translate(SiteCopyKey.SetupAgentName)}>`;
  const startLink = startLinkOf({ locale });
  const clients = quickStartEntriesOf({ locale, origin, connectionLink: SETUP_CONNECTION_PLACEHOLDER }).flatMap(
    (entry): MarkdownBlock[] => [
      heading({ level: HeadingLevel.Item, text: entry.name }),
      paragraph({ text: entry.hint }),
      ...(entry.path.length === 0 ? [] : [list({ items: entry.path, isOrdered: true })]),
      { kind: MarkdownBlockKind.Code, language: '', code: entry.code },
    ],
  );
  return renderMarkdown({
    blocks: [
      heading({ level: HeadingLevel.Page, text: translate(SiteCopyKey.SetupTitle) }),
      paragraph({ text: translate(SiteCopyKey.SetupIntro) }),
      heading({ level: HeadingLevel.Section, text: translate(SiteCopyKey.SetupStepOneTitle) }),
      paragraph({ text: translate(SiteCopyKey.SetupStepOneBody, { startLink, command }) }),
      heading({ level: HeadingLevel.Section, text: translate(SiteCopyKey.SetupStepTwoTitle) }),
      paragraph({ text: translate(SiteCopyKey.SetupStepTwoBody, { placeholder: SETUP_CONNECTION_PLACEHOLDER }) }),
      ...clients,
      heading({ level: HeadingLevel.Section, text: translate(SiteCopyKey.SetupStepThreeTitle) }),
      paragraph({ text: translate(SiteCopyKey.SetupStepThreeBody, { selfTest: INSTALL_SELF_TEST_TEXT[locale] }) }),
      heading({ level: HeadingLevel.Section, text: translate(SiteCopyKey.SetupSafetyTitle) }),
      paragraph({ text: translate(SiteCopyKey.SetupSafetyBody) }),
    ],
  });
}
