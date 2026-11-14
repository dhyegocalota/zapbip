import { CLIENT_APP_LOGIN_TEXT, CommandKind, OwnerLocale } from '@zapbip/types';

export type CommandWord = {
  kind: CommandKind;
  locale: OwnerLocale;
  words: string;
  takesName: boolean;
};

type LocaleWords = {
  createAgent: string;
  listAgents: string;
  revokeAgent: string;
  rotateAgent: string;
  help: string[];
  requestDeletion: string;
  confirmDeletion: string;
  setLanguage: string;
};

const LOCALE_WORDS: Record<OwnerLocale, LocaleWords> = {
  [OwnerLocale.EnglishUs]: {
    createAgent: 'new agent',
    listAgents: 'agents',
    revokeAgent: 'revoke',
    rotateAgent: 'rotate',
    help: ['help', 'menu'],
    requestDeletion: 'delete account',
    confirmDeletion: 'delete account permanently',
    setLanguage: 'language',
  },
  [OwnerLocale.PortugueseBrazil]: {
    createAgent: 'novo agente',
    listAgents: 'agentes',
    revokeAgent: 'revogar',
    rotateAgent: 'renovar',
    help: ['ajuda', 'menu'],
    requestDeletion: 'apagar conta',
    confirmDeletion: 'apagar conta definitivamente',
    setLanguage: 'idioma',
  },
  [OwnerLocale.Spanish]: {
    createAgent: 'nuevo agente',
    listAgents: 'mis agentes',
    revokeAgent: 'revocar',
    rotateAgent: 'rotar',
    help: ['ayuda'],
    requestDeletion: 'eliminar cuenta',
    confirmDeletion: 'eliminar cuenta definitivamente',
    setLanguage: 'cambiar idioma',
  },
  [OwnerLocale.German]: {
    createAgent: 'neuer agent',
    listAgents: 'meine agenten',
    revokeAgent: 'widerrufen',
    rotateAgent: 'erneuern',
    help: ['hilfe', 'menü'],
    requestDeletion: 'konto löschen',
    confirmDeletion: 'konto endgültig löschen',
    setLanguage: 'sprache',
  },
  [OwnerLocale.French]: {
    createAgent: 'nouvel agent',
    listAgents: 'mes agents',
    revokeAgent: 'révoquer',
    rotateAgent: 'renouveler',
    help: ['aide'],
    requestDeletion: 'supprimer le compte',
    confirmDeletion: 'supprimer le compte définitivement',
    setLanguage: 'langue',
  },
  [OwnerLocale.Japanese]: {
    createAgent: '新規エージェント',
    listAgents: 'エージェント一覧',
    revokeAgent: '無効化',
    rotateAgent: '再発行',
    help: ['ヘルプ'],
    requestDeletion: 'アカウント削除',
    confirmDeletion: 'アカウント完全削除',
    setLanguage: '言語',
  },
  [OwnerLocale.Korean]: {
    createAgent: '새 에이전트',
    listAgents: '에이전트 목록',
    revokeAgent: '폐기',
    rotateAgent: '재발급',
    help: ['도움말'],
    requestDeletion: '계정 삭제',
    confirmDeletion: '계정 영구 삭제',
    setLanguage: '언어',
  },
  [OwnerLocale.ChineseSimplified]: {
    createAgent: '新建智能体',
    listAgents: '智能体列表',
    revokeAgent: '撤销',
    rotateAgent: '轮换',
    help: ['帮助'],
    requestDeletion: '删除账户',
    confirmDeletion: '永久删除账户',
    setLanguage: '语言',
  },
  [OwnerLocale.Arabic]: {
    createAgent: 'وكيل جديد',
    listAgents: 'وكلائي',
    revokeAgent: 'إبطال',
    rotateAgent: 'تجديد رابط',
    help: ['مساعدة', 'القائمة'],
    requestDeletion: 'حذف الحساب',
    confirmDeletion: 'حذف الحساب نهائيا',
    setLanguage: 'تغيير اللغة',
  },
  [OwnerLocale.Hindi]: {
    createAgent: 'नया एजेंट',
    listAgents: 'मेरे एजेंट',
    revokeAgent: 'एजेंट हटाएँ',
    rotateAgent: 'लिंक बदलें',
    help: ['मदद', 'मेनू'],
    requestDeletion: 'अकाउंट डिलीट करें',
    confirmDeletion: 'अकाउंट हमेशा के लिए डिलीट करें',
    setLanguage: 'भाषा बदलें',
  },
};

function wordsOf(input: { locale: OwnerLocale }): CommandWord[] {
  const { locale } = input;
  const words = LOCALE_WORDS[locale];
  return [
    { kind: CommandKind.CreateAgent, locale, words: words.createAgent, takesName: true },
    { kind: CommandKind.ListAgents, locale, words: words.listAgents, takesName: false },
    { kind: CommandKind.RevokeAgent, locale, words: words.revokeAgent, takesName: true },
    { kind: CommandKind.RotateAgent, locale, words: words.rotateAgent, takesName: true },
    ...words.help.map((help) => ({ kind: CommandKind.Help, locale, words: help, takesName: false })),
    { kind: CommandKind.Login, locale, words: CLIENT_APP_LOGIN_TEXT[locale], takesName: false },
    { kind: CommandKind.RequestDeletion, locale, words: words.requestDeletion, takesName: false },
    { kind: CommandKind.ConfirmDeletion, locale, words: words.confirmDeletion, takesName: false },
    { kind: CommandKind.SetLanguage, locale, words: words.setLanguage, takesName: true },
  ];
}

export const COMMAND_WORDS: readonly CommandWord[] = Object.values(OwnerLocale).flatMap((locale) => wordsOf({ locale }));

export const MENU_COMMAND_KINDS: readonly CommandKind[] = [
  CommandKind.CreateAgent,
  CommandKind.ListAgents,
  CommandKind.RevokeAgent,
  CommandKind.RotateAgent,
  CommandKind.Help,
  CommandKind.SetLanguage,
  CommandKind.RequestDeletion,
];
