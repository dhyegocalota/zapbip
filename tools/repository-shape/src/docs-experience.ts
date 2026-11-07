import { MEDIA_RETENTION_MS, QUEUE_RETENTION_MS, QUESTION_RETENTION_MS } from '@zapbip/core';
import { DAY_MS, DocsLanguage, DocsOnlyClient, DocsRetentionKind, InstallClient, WakeRung } from '@zapbip/types';
import { DOCS_ROOT, readRepositoryFile } from './repository-files';

export enum ScheduledWakeRung {
  Scheduled = 'scheduled',
  Standby = 'standby',
}

export type ListenRung = WakeRung | ScheduledWakeRung;

export type DocsAgentClient = InstallClient | DocsOnlyClient;

export enum AgentPageSection {
  WhatWorks = 'whatWorks',
  HowItListens = 'howItListens',
  SetupFromZero = 'setupFromZero',
  CheckItWorks = 'checkItWorks',
}

export const AGENT_PAGE_SECTIONS: AgentPageSection[] = [
  AgentPageSection.WhatWorks,
  AgentPageSection.HowItListens,
  AgentPageSection.SetupFromZero,
  AgentPageSection.CheckItWorks,
];

export const AGENT_PAGE_HEADINGS: Record<DocsLanguage, Record<AgentPageSection, string>> = {
  [DocsLanguage.English]: {
    [AgentPageSection.WhatWorks]: 'What works',
    [AgentPageSection.HowItListens]: 'How it listens',
    [AgentPageSection.SetupFromZero]: 'Set up from zero',
    [AgentPageSection.CheckItWorks]: 'Check it works',
  },
  [DocsLanguage.PortugueseBrazil]: {
    [AgentPageSection.WhatWorks]: 'O que funciona',
    [AgentPageSection.HowItListens]: 'Como ela escuta',
    [AgentPageSection.SetupFromZero]: 'Configure do zero',
    [AgentPageSection.CheckItWorks]: 'Confira se funciona',
  },
};

export const WAKE_RUNG_LABELS: Record<DocsLanguage, Record<ListenRung, string>> = {
  [DocsLanguage.English]: {
    [WakeRung.Inbox]: 'Inbox',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [ScheduledWakeRung.Scheduled]: 'Scheduled',
    [ScheduledWakeRung.Standby]: 'Standby',
  },
  [DocsLanguage.PortugueseBrazil]: {
    [WakeRung.Inbox]: 'Caixa de entrada',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [ScheduledWakeRung.Scheduled]: 'Agendada',
    [ScheduledWakeRung.Standby]: 'Em espera',
  },
};

const ONE_HOUR_SECONDS = 3600;

export const CLIENT_LISTEN_FACTS: Record<DocsAgentClient, { rung: ListenRung; expectedDelaySeconds: number | null }> = {
  [InstallClient.ClaudeCode]: { rung: WakeRung.Local, expectedDelaySeconds: 7 },
  [InstallClient.Codex]: { rung: WakeRung.Local, expectedDelaySeconds: 6 },
  [InstallClient.Cursor]: { rung: WakeRung.Local, expectedDelaySeconds: null },
  [InstallClient.GeminiCli]: { rung: WakeRung.Local, expectedDelaySeconds: null },
  [InstallClient.Hermes]: { rung: WakeRung.Local, expectedDelaySeconds: null },
  [InstallClient.OpenClaw]: { rung: WakeRung.Local, expectedDelaySeconds: null },
  [InstallClient.GrokBot]: { rung: WakeRung.Webhook, expectedDelaySeconds: 9 },
  [InstallClient.ClaudeAi]: { rung: WakeRung.Webhook, expectedDelaySeconds: 16 },
  [InstallClient.ChatGpt]: { rung: ScheduledWakeRung.Scheduled, expectedDelaySeconds: ONE_HOUR_SECONDS },
  [InstallClient.GrokWeb]: { rung: ScheduledWakeRung.Standby, expectedDelaySeconds: null },
  [DocsOnlyClient.AnyMcpClient]: { rung: WakeRung.Inbox, expectedDelaySeconds: null },
};

export const LISTEN_STATEMENT_TOKENS: Record<DocsLanguage, { pending: string; recallsUntilAnswered: string; noTimeLimit: string }> = {
  [DocsLanguage.English]: { pending: 'pending', recallsUntilAnswered: 'again', noTimeLimit: 'no time limit' },
  [DocsLanguage.PortugueseBrazil]: { pending: 'pendente', recallsUntilAnswered: 'de novo', noTimeLimit: 'sem limite de tempo' },
};

export const DOCS_GROUPS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Get started', 'Agents', 'Features', 'Help', 'For developers'],
  [DocsLanguage.PortugueseBrazil]: ['Primeiros passos', 'IAs', 'Funcionalidades', 'Ajuda', 'Para desenvolvedores'],
};

export const PAGE_LANGUAGE_FOLDER = 'pt-br';

export const DOCS_DEVELOPER_LINK_PREFIXES: string[] = [
  '/developers/',
  '/mcp-reference/',
  '/concepts/',
  `/${PAGE_LANGUAGE_FOLDER}/developers/`,
  `/${PAGE_LANGUAGE_FOLDER}/mcp-reference/`,
  `/${PAGE_LANGUAGE_FOLDER}/concepts/`,
];

export const CHAT_MAX_MESSAGES = 4;

export const INSTALL_PROMPT_MAX_LINES = 2;

export const RETENTION_DAYS: Record<DocsRetentionKind, number> = {
  [DocsRetentionKind.Questions]: QUESTION_RETENTION_MS / DAY_MS,
  [DocsRetentionKind.Queue]: QUEUE_RETENTION_MS / DAY_MS,
  [DocsRetentionKind.Media]: MEDIA_RETENTION_MS / DAY_MS,
};

export function agentPagePathOf(input: { client: DocsAgentClient; language: DocsLanguage }): string {
  throw new Error('agentPagePathOf is not implemented');
}

export function twinPathOf(input: { path: string; language: DocsLanguage }): string {
  throw new Error('twinPathOf is not implemented');
}

export function sectionOf(input: { markdown: string; heading: string }): string {
  throw new Error('sectionOf is not implemented');
}

export function headingsOf(input: { markdown: string }): string[] {
  throw new Error('headingsOf is not implemented');
}

export function chatBlocksOf(input: { markdown: string }): string[] {
  throw new Error('chatBlocksOf is not implemented');
}

export function messageCountOf(input: { block: string }): number {
  throw new Error('messageCountOf is not implemented');
}

export function linksOf(input: { markdown: string }): string[] {
  throw new Error('linksOf is not implemented');
}

export function linesOf(input: { text: string }): string[] {
  throw new Error('linesOf is not implemented');
}

export function missingListenTokens(input: { section: string; language: DocsLanguage }): string[] {
  throw new Error('missingListenTokens is not implemented');
}

export function developerLinkViolations(input: { page: string; links: string[] }): string[] {
  throw new Error('developerLinkViolations is not implemented');
}

export type NavigationNode = string | { group: string; pages: NavigationNode[] };
export type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

const DOCS_CONFIG = `${DOCS_ROOT}/docs.json`;

export function docsNavigationOf(input: { language: DocsLanguage }): LanguageNavigation {
  const languages = JSON.parse(readRepositoryFile(DOCS_CONFIG)).navigation.languages as LanguageNavigation[];
  const found = languages.find((entry) => entry.language === input.language);
  if (!found) throw new Error(`no navigation for ${input.language}`);
  return found;
}

function pagesOf(nodes: NavigationNode[]): string[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [node] : pagesOf(node.pages)));
}

export function navigationPagesOf(input: { language: DocsLanguage }): string[] {
  return pagesOf(docsNavigationOf(input).groups.flatMap((group) => group.pages));
}
