import { DOCS_LANGUAGE_FOLDERS, DocsPageLanguage, WakeRung } from '@zapbip/types';

export const AGENTS_DIRECTORY = 'agents';
export const SNIPPETS_DIRECTORY = 'snippets';

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

export const AGENT_PAGE_HEADINGS: Record<DocsPageLanguage, Record<AgentPageSection, string>> = {
  [DocsPageLanguage.English]: {
    [AgentPageSection.WhatWorks]: 'What works',
    [AgentPageSection.HowItListens]: 'How it listens',
    [AgentPageSection.SetupFromZero]: 'Set up from zero',
    [AgentPageSection.CheckItWorks]: 'Check it works',
  },
  [DocsPageLanguage.PortugueseBrazil]: {
    [AgentPageSection.WhatWorks]: 'O que funciona',
    [AgentPageSection.HowItListens]: 'Como ela escuta',
    [AgentPageSection.SetupFromZero]: 'Configure do zero',
    [AgentPageSection.CheckItWorks]: 'Confira se funciona',
  },
  [DocsPageLanguage.Spanish]: {
    [AgentPageSection.WhatWorks]: 'Qué funciona',
    [AgentPageSection.HowItListens]: 'Cómo escucha',
    [AgentPageSection.SetupFromZero]: 'Configúralo desde cero',
    [AgentPageSection.CheckItWorks]: 'Comprueba que funciona',
  },
  [DocsPageLanguage.German]: {
    [AgentPageSection.WhatWorks]: 'Was funktioniert',
    [AgentPageSection.HowItListens]: 'So hört sie zu',
    [AgentPageSection.SetupFromZero]: 'Von Grund auf einrichten',
    [AgentPageSection.CheckItWorks]: 'Prüfen, ob es funktioniert',
  },
  [DocsPageLanguage.French]: {
    [AgentPageSection.WhatWorks]: 'Ce qui fonctionne',
    [AgentPageSection.HowItListens]: 'Comment elle écoute',
    [AgentPageSection.SetupFromZero]: 'Configurer de zéro',
    [AgentPageSection.CheckItWorks]: 'Vérifier que ça marche',
  },
  [DocsPageLanguage.Japanese]: {
    [AgentPageSection.WhatWorks]: '使えること',
    [AgentPageSection.HowItListens]: '聞き取りの仕組み',
    [AgentPageSection.SetupFromZero]: 'ゼロから設定する',
    [AgentPageSection.CheckItWorks]: '動作の確認',
  },
  [DocsPageLanguage.Korean]: {
    [AgentPageSection.WhatWorks]: '지원하는 기능',
    [AgentPageSection.HowItListens]: '수신 방식',
    [AgentPageSection.SetupFromZero]: '처음부터 설정하기',
    [AgentPageSection.CheckItWorks]: '작동 확인',
  },
  [DocsPageLanguage.Chinese]: {
    [AgentPageSection.WhatWorks]: '支持的功能',
    [AgentPageSection.HowItListens]: '监听方式',
    [AgentPageSection.SetupFromZero]: '从零开始设置',
    [AgentPageSection.CheckItWorks]: '检查是否正常工作',
  },
};

export const WAKE_RUNG_LABELS: Record<DocsPageLanguage, Record<WakeRung, string>> = {
  [DocsPageLanguage.English]: {
    [WakeRung.Inbox]: 'Inbox',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Scheduled',
    [WakeRung.Standby]: 'Standby',
  },
  [DocsPageLanguage.PortugueseBrazil]: {
    [WakeRung.Inbox]: 'Caixa de entrada',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Agendada',
    [WakeRung.Standby]: 'Em espera',
  },
  [DocsPageLanguage.Spanish]: {
    [WakeRung.Inbox]: 'Bandeja de entrada',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Programado',
    [WakeRung.Standby]: 'En espera',
  },
  [DocsPageLanguage.German]: {
    [WakeRung.Inbox]: 'Posteingang',
    [WakeRung.Local]: 'Lokal',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Geplant',
    [WakeRung.Standby]: 'Bereitschaft',
  },
  [DocsPageLanguage.French]: {
    [WakeRung.Inbox]: 'Boîte de réception',
    [WakeRung.Local]: 'Local',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'Planifié',
    [WakeRung.Standby]: 'En veille',
  },
  [DocsPageLanguage.Japanese]: {
    [WakeRung.Inbox]: '受信トレイ',
    [WakeRung.Local]: 'ローカル',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: 'スケジュール',
    [WakeRung.Standby]: '待機',
  },
  [DocsPageLanguage.Korean]: {
    [WakeRung.Inbox]: '받은편지함',
    [WakeRung.Local]: '로컬',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: '예약',
    [WakeRung.Standby]: '대기',
  },
  [DocsPageLanguage.Chinese]: {
    [WakeRung.Inbox]: '收件箱',
    [WakeRung.Local]: '本地',
    [WakeRung.Webhook]: 'Webhook',
    [WakeRung.Scheduled]: '定时',
    [WakeRung.Standby]: '待命',
  },
};

export const LISTEN_STATEMENT_TOKENS: Record<DocsPageLanguage, { pending: string; recallsUntilAnswered: string; noTimeLimit: string }> = {
  [DocsPageLanguage.English]: { pending: 'pending', recallsUntilAnswered: 'again', noTimeLimit: 'no time limit' },
  [DocsPageLanguage.PortugueseBrazil]: { pending: 'pendente', recallsUntilAnswered: 'de novo', noTimeLimit: 'sem limite de tempo' },
  [DocsPageLanguage.Spanish]: { pending: 'pendiente', recallsUntilAnswered: 'otra vez', noTimeLimit: 'sin límite de tiempo' },
  [DocsPageLanguage.German]: { pending: 'ausstehend', recallsUntilAnswered: 'erneut', noTimeLimit: 'ohne Zeitlimit' },
  [DocsPageLanguage.French]: { pending: 'en attente', recallsUntilAnswered: 'à nouveau', noTimeLimit: 'sans limite de temps' },
  [DocsPageLanguage.Japanese]: { pending: '保留中', recallsUntilAnswered: 'もう一度', noTimeLimit: '時間制限なし' },
  [DocsPageLanguage.Korean]: { pending: '보류 중', recallsUntilAnswered: '다시', noTimeLimit: '시간 제한 없이' },
  [DocsPageLanguage.Chinese]: { pending: '待处理', recallsUntilAnswered: '再次', noTimeLimit: '没有时间限制' },
};

export const AGENTS_GROUP_INDEX = 1;

export const DOCS_GROUPS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['Get started', 'Agents', 'Features', 'Help', 'For developers'],
  [DocsPageLanguage.PortugueseBrazil]: ['Primeiros passos', 'IAs', 'Funcionalidades', 'Ajuda', 'Para desenvolvedores'],
  [DocsPageLanguage.Spanish]: ['Primeros pasos', 'IAs', 'Funciones', 'Ayuda', 'Para desarrolladores'],
  [DocsPageLanguage.German]: ['Erste Schritte', 'KIs', 'Funktionen', 'Hilfe', 'Für Entwickler'],
  [DocsPageLanguage.French]: ['Premiers pas', 'IA', 'Fonctionnalités', 'Aide', 'Pour les développeurs'],
  [DocsPageLanguage.Japanese]: ['はじめに', 'AI', '機能', 'ヘルプ', '開発者向け'],
  [DocsPageLanguage.Korean]: ['시작하기', 'AI', '기능', '도움말', '개발자용'],
  [DocsPageLanguage.Chinese]: ['快速开始', 'AI', '功能', '帮助', '开发者'],
};

export function perLanguage<Value>(input: { valueOf: (language: DocsPageLanguage) => Value }): Record<DocsPageLanguage, Value> {
  const entries = Object.values(DocsPageLanguage).map((language) => [language, input.valueOf(language)]);
  return Object.fromEntries(entries) as Record<DocsPageLanguage, Value>;
}

export function languageOfPage(input: { path: string }): DocsPageLanguage {
  const [firstSegment] = input.path.split('/');
  const translated = Object.values(DocsPageLanguage).find(
    (candidate) => candidate !== DocsPageLanguage.English && DOCS_LANGUAGE_FOLDERS[candidate] === firstSegment,
  );
  if (translated === undefined) return DocsPageLanguage.English;
  return translated;
}

export function twinPathOf(input: { path: string; language: DocsPageLanguage }): string {
  const sourceFolder = DOCS_LANGUAGE_FOLDERS[languageOfPage({ path: input.path })];
  const englishPath = sourceFolder === '' ? input.path : input.path.slice(sourceFolder.length + 1);
  const targetFolder = DOCS_LANGUAGE_FOLDERS[input.language];
  return targetFolder === '' ? englishPath : `${targetFolder}/${englishPath}`;
}

export function snippetPathOf(input: { name: string; language: DocsPageLanguage }): string {
  const folder = DOCS_LANGUAGE_FOLDERS[input.language];
  if (folder === '') return `${SNIPPETS_DIRECTORY}/${input.name}`;
  return `${SNIPPETS_DIRECTORY}/${folder}/${input.name}`;
}

export function agentPagePathOf(input: { client: string; language: DocsPageLanguage }): string {
  return twinPathOf({ path: `${AGENTS_DIRECTORY}/${input.client}`, language: input.language });
}
