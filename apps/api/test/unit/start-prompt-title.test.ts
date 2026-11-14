import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';

const AGENT = 'Claude Code';
const MAXIMUM_TITLE_CHARACTERS = 32;
const TITLES: [OwnerLocale, string, string][] = [
  [OwnerLocale.EnglishUs, 'Prompt in Claude Code', 'Prompt in your AI app'],
  [OwnerLocale.PortugueseBrazil, 'Prompt no Claude Code', 'Prompt no seu app de IA'],
  [OwnerLocale.Spanish, 'Prompt en Claude Code', 'Prompt en tu app de IA'],
  [OwnerLocale.German, 'Prompt in Claude Code', 'Prompt in deiner KI-App'],
  [OwnerLocale.French, 'Prompt dans Claude Code', 'Prompt dans votre appli d’IA'],
  [OwnerLocale.Japanese, 'Claude Code 用のプロンプト', 'AIアプリ用のプロンプト'],
  [OwnerLocale.Korean, 'Claude Code용 프롬프트', 'AI 앱용 프롬프트'],
  [OwnerLocale.ChineseSimplified, 'Claude Code 的提示词', 'AI 应用的提示词'],
];

describe('the title of the quick-start window', () => {
  it.each(TITLES)('names the agent in %s', (locale, agentTitle) => {
    expect(renderSiteCopy({ key: SiteCopyKey.StartPromptHint, locale, values: { agent: AGENT } })).toBe(agentTitle);
  });

  it.each(TITLES)('names an AI app in %s', (locale, _agentTitle, anyTitle) => {
    expect(renderSiteCopy({ key: SiteCopyKey.StartPromptHintAny, locale })).toBe(anyTitle);
  });

  it.each(TITLES)('stays on one line of a 360 px phone in %s', (locale) => {
    const titles = [
      renderSiteCopy({ key: SiteCopyKey.StartPromptHint, locale, values: { agent: AGENT } }),
      renderSiteCopy({ key: SiteCopyKey.StartPromptHintAny, locale }),
    ];
    expect(titles.filter((title) => [...title].length > MAXIMUM_TITLE_CHARACTERS)).toEqual([]);
  });

  it.each(TITLES)('keeps the word Prompt, or its loanword, in %s and never says paste', (locale, agentTitle) => {
    expect(agentTitle).toMatch(/Prompt|プロンプト|프롬프트|提示词/);
    expect(agentTitle).not.toMatch(/Paste|Cole|Pega|Füge|Collez|貼り付け|붙여넣|粘贴/);
  });
});
