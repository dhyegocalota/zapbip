import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DocsLanguage, INSTALL_SELF_TEST_TEXT, OwnerLocale, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AgentInstall } from '../contract';
import { AGENT_PAGE_HEADINGS, AgentPageSection } from '../docs';
import { AGENT_INSTALLS } from '../generated/install';
import { guideParityViolationsOf, type GuideParityEntry } from './guide-parity';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SYNTHETIC_ID = 'synthetic-agent';
const ENGLISH_SELF_TEST = INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs];
const PORTUGUESE_SELF_TEST = INSTALL_SELF_TEST_TEXT[OwnerLocale.PortugueseBrazil];
const SELF_TEST_COMMAND = `claude -p "Call send_message with the text '${ENGLISH_SELF_TEST}'"`;
const SECTION_LINES = [
  '## Synthetic Agent',
  '',
  '1. If you are not Synthetic Agent, stop and run no other step of this section. Success: you are Synthetic Agent, or you have stopped.',
  '2. Run `claude mcp add`. Success: the list shows it.',
];
const CHAT_SELF_TEST_LINE = `3. In this chat, call send_message with the text "${ENGLISH_SELF_TEST}". Success: it returns.`;
const COMMAND_SELF_TEST_LINE = `3. In a fresh process run \`${SELF_TEST_COMMAND}\`. Success: it exits with zero.`;

function installRendering(input: { lastLine: string }): AgentInstall {
  return {
    productName: 'Synthetic Agent',
    productDescription: 'Synthetic Agent, the agent the tests use',
    officialLogo: null,
    quickStart: ({ connectionLink }) => ({ hint: 'Synthetic', path: ['Open the settings'], code: connectionLink }),
    render: () => [...SECTION_LINES, input.lastLine].join('\n'),
  };
}

function guideOf(input: { language: DocsLanguage; steps: string[]; extraHeading?: string }): string {
  const headings = AGENT_PAGE_HEADINGS[input.language];
  const extraSection = input.extraHeading === undefined ? [] : [`## ${input.extraHeading}`, '', 'Extra.', ''];
  return [
    `## ${headings[AgentPageSection.WhatWorks]}`,
    '',
    'It works.',
    '',
    `## ${headings[AgentPageSection.HowItListens]}`,
    '',
    'It listens.',
    '',
    ...extraSection,
    `## ${headings[AgentPageSection.SetupFromZero]}`,
    '',
    ...input.steps.map((step, index) => `${index + 1}. ${step}\n`),
    `## ${headings[AgentPageSection.CheckItWorks]}`,
    '',
    'Check.',
  ].join('\n');
}

function chatSteps(input: { selfTest: string; extraAction?: string }): string[] {
  return [
    'Say yes.',
    'It runs `claude mcp add`.',
    ...(input.extraAction === undefined ? [] : [input.extraAction]),
    `It calls send_message with ${input.selfTest}.`,
  ];
}

function syntheticEntry(input: Partial<GuideParityEntry> & { lastLine?: string }): GuideParityEntry {
  return {
    id: SYNTHETIC_ID,
    install: installRendering({ lastLine: input.lastLine === undefined ? CHAT_SELF_TEST_LINE : input.lastLine }),
    isPluginPage: input.isPluginPage === undefined ? false : input.isPluginPage,
    guides: input.guides === undefined ? goodGuides() : input.guides,
  };
}

function goodGuides(): Record<DocsLanguage, string> {
  return {
    [DocsLanguage.English]: guideOf({ language: DocsLanguage.English, steps: chatSteps({ selfTest: ENGLISH_SELF_TEST }) }),
    [DocsLanguage.PortugueseBrazil]: guideOf({
      language: DocsLanguage.PortugueseBrazil,
      steps: chatSteps({ selfTest: PORTUGUESE_SELF_TEST }),
    }),
  };
}

function realEntries(): GuideParityEntry[] {
  return Object.entries(AGENT_INSTALLS).map(([id, install]) => ({
    id,
    install,
    isPluginPage: existsSync(`${REPOSITORY_ROOT}libs/agents/supported/${id}/plugin.ts`),
    guides: {
      [DocsLanguage.English]: readFileSync(`${REPOSITORY_ROOT}apps/docs/agents/${id}.mdx`, 'utf8'),
      [DocsLanguage.PortugueseBrazil]: readFileSync(`${REPOSITORY_ROOT}apps/docs/${PAGE_LANGUAGE_FOLDER}/agents/${id}.mdx`, 'utf8'),
    },
  }));
}

describe('guideParityViolationsOf', () => {
  test('accepts the guides of every real agent', () => {
    expect(guideParityViolationsOf({ entries: realEntries() })).toEqual([]);
  });

  test('accepts guides that mirror the section', () => {
    expect(guideParityViolationsOf({ entries: [syntheticEntry({})] })).toEqual([]);
  });

  test('finds the set-up section by its heading, wherever it sits', () => {
    const guides = {
      ...goodGuides(),
      [DocsLanguage.English]: guideOf({
        language: DocsLanguage.English,
        steps: chatSteps({ selfTest: ENGLISH_SELF_TEST }),
        extraHeading: 'Extra',
      }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ guides })] })).toEqual([]);
  });

  test('rejects an English guide with an action the section does not have', () => {
    const guides = {
      ...goodGuides(),
      [DocsLanguage.English]: guideOf({
        language: DocsLanguage.English,
        steps: chatSteps({ selfTest: ENGLISH_SELF_TEST, extraAction: 'It runs `claude mcp remove`.' }),
      }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ guides })] })).toContain(
      `${SYNTHETIC_ID}: the English guide must name the same actions in the same order as the install section`,
    );
  });

  test('rejects an English guide with a wake mode the section does not have', () => {
    const guides = {
      ...goodGuides(),
      [DocsLanguage.English]: guideOf({
        language: DocsLanguage.English,
        steps: chatSteps({ selfTest: ENGLISH_SELF_TEST, extraAction: 'It calls set_wake({mode: "local"}).' }),
      }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ guides })] })).toContain(
      `${SYNTHETIC_ID}: the English guide must name the same wake modes as the install section`,
    );
  });

  test('rejects a Portuguese twin whose actions differ from the English guide', () => {
    const guides = {
      ...goodGuides(),
      [DocsLanguage.PortugueseBrazil]: guideOf({
        language: DocsLanguage.PortugueseBrazil,
        steps: chatSteps({ selfTest: PORTUGUESE_SELF_TEST, extraAction: 'Ele roda `claude mcp remove`.' }),
      }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ guides })] })).toContain(
      `${SYNTHETIC_ID}: the Portuguese guide must have the same actions and wake modes as the English guide`,
    );
  });

  test('rejects a guide with no set-up section', () => {
    const guides = { ...goodGuides(), [DocsLanguage.English]: '## What works\n\nNothing.' };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ guides })] })).toContain(
      `${SYNTHETIC_ID}: the English guide has no "Set up from zero" section`,
    );
  });

  test('rejects a step guide that does not end with the self-test', () => {
    const guides = {
      ...goodGuides(),
      [DocsLanguage.English]: guideOf({ language: DocsLanguage.English, steps: ['Say yes.', 'It runs `claude mcp add`.', 'Done.'] }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ guides })] })).toContain(
      `${SYNTHETIC_ID}: the English guide must end with the self-test`,
    );
  });

  test('rejects a guide that does not run the self-test command of the section', () => {
    const entry = syntheticEntry({ lastLine: COMMAND_SELF_TEST_LINE });
    expect(guideParityViolationsOf({ entries: [entry] })).toContain(
      `${SYNTHETIC_ID}: the English guide must run the self-test command of the install section`,
    );
  });

  test('accepts a guide that runs the self-test command of the section', () => {
    const steps = [
      'Say yes.',
      'It runs `claude mcp add`.',
      `It runs \`${SELF_TEST_COMMAND}\` and calls send_message with ${ENGLISH_SELF_TEST}.`,
    ];
    const portugueseSteps = [
      'Diga sim.',
      'Ele roda `claude mcp add`.',
      `Ele roda \`${SELF_TEST_COMMAND}\` e chama send_message com ${PORTUGUESE_SELF_TEST}.`,
    ];
    const guides = {
      [DocsLanguage.English]: guideOf({ language: DocsLanguage.English, steps }),
      [DocsLanguage.PortugueseBrazil]: guideOf({ language: DocsLanguage.PortugueseBrazil, steps: portugueseSteps }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ lastLine: COMMAND_SELF_TEST_LINE, guides })] })).toEqual([]);
  });

  test('rejects a plugin page that holds the other language self-test', () => {
    const guides = {
      ...goodGuides(),
      [DocsLanguage.English]: guideOf({
        language: DocsLanguage.English,
        steps: chatSteps({ selfTest: `${ENGLISH_SELF_TEST} ${PORTUGUESE_SELF_TEST}` }),
      }),
    };
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ isPluginPage: true, guides })] })).toContain(
      `${SYNTHETIC_ID}: the English plugin page must ask for its own self-test only`,
    );
  });

  test('accepts a plugin page that holds only its own self-test', () => {
    expect(guideParityViolationsOf({ entries: [syntheticEntry({ isPluginPage: true })] })).toEqual([]);
  });
});
