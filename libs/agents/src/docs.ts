import { DocsLanguage, PAGE_LANGUAGE_FOLDER, WakeRung } from '@zapbip/types';

export const AGENTS_DIRECTORY = 'agents';

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

export const WAKE_RUNG_LABELS: Record<DocsLanguage, Record<WakeRung, string>> = {
  [DocsLanguage.English]: {
    [WakeRung.Inbox]: 'Inbox',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Scheduled',
    [WakeRung.Standby]: 'Standby',
  },
  [DocsLanguage.PortugueseBrazil]: {
    [WakeRung.Inbox]: 'Caixa de entrada',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Agendada',
    [WakeRung.Standby]: 'Em espera',
  },
};

export const LISTEN_STATEMENT_TOKENS: Record<DocsLanguage, { pending: string; recallsUntilAnswered: string; noTimeLimit: string }> = {
  [DocsLanguage.English]: { pending: 'pending', recallsUntilAnswered: 'again', noTimeLimit: 'no time limit' },
  [DocsLanguage.PortugueseBrazil]: { pending: 'pendente', recallsUntilAnswered: 'de novo', noTimeLimit: 'sem limite de tempo' },
};

export const DOCS_GROUPS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Get started', 'Agents', 'Features', 'Help', 'For developers'],
  [DocsLanguage.PortugueseBrazil]: ['Primeiros passos', 'IAs', 'Funcionalidades', 'Ajuda', 'Para desenvolvedores'],
};

export function twinPathOf(input: { path: string; language: DocsLanguage }): string {
  const folderPrefix = `${PAGE_LANGUAGE_FOLDER}/`;
  const englishPath = input.path.startsWith(folderPrefix) ? input.path.slice(folderPrefix.length) : input.path;
  return input.language === DocsLanguage.English ? englishPath : `${folderPrefix}${englishPath}`;
}

export function agentPagePathOf(input: { client: string; language: DocsLanguage }): string {
  return twinPathOf({ path: `${AGENTS_DIRECTORY}/${input.client}`, language: input.language });
}
