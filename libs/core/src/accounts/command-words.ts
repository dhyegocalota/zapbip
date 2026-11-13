import { CLIENT_APP_LOGIN_TEXT, CommandKind, OwnerLocale } from '@zapbip/types';

export type CommandWord = {
  kind: CommandKind;
  locale: OwnerLocale;
  words: string;
  takesName: boolean;
};

export const COMMAND_WORDS: readonly CommandWord[] = [
  { kind: CommandKind.CreateAgent, locale: OwnerLocale.PortugueseBrazil, words: 'novo agente', takesName: true },
  { kind: CommandKind.CreateAgent, locale: OwnerLocale.EnglishUs, words: 'new agent', takesName: true },
  { kind: CommandKind.ListAgents, locale: OwnerLocale.PortugueseBrazil, words: 'agentes', takesName: false },
  { kind: CommandKind.ListAgents, locale: OwnerLocale.EnglishUs, words: 'agents', takesName: false },
  { kind: CommandKind.RevokeAgent, locale: OwnerLocale.PortugueseBrazil, words: 'revogar', takesName: true },
  { kind: CommandKind.RevokeAgent, locale: OwnerLocale.EnglishUs, words: 'revoke', takesName: true },
  { kind: CommandKind.RotateAgent, locale: OwnerLocale.PortugueseBrazil, words: 'girar', takesName: true },
  { kind: CommandKind.RotateAgent, locale: OwnerLocale.EnglishUs, words: 'rotate', takesName: true },
  { kind: CommandKind.Help, locale: OwnerLocale.PortugueseBrazil, words: 'ajuda', takesName: false },
  { kind: CommandKind.Help, locale: OwnerLocale.PortugueseBrazil, words: 'menu', takesName: false },
  { kind: CommandKind.Help, locale: OwnerLocale.EnglishUs, words: 'help', takesName: false },
  { kind: CommandKind.Help, locale: OwnerLocale.EnglishUs, words: 'menu', takesName: false },
  {
    kind: CommandKind.Login,
    locale: OwnerLocale.PortugueseBrazil,
    words: CLIENT_APP_LOGIN_TEXT[OwnerLocale.PortugueseBrazil],
    takesName: false,
  },
  { kind: CommandKind.Login, locale: OwnerLocale.EnglishUs, words: CLIENT_APP_LOGIN_TEXT[OwnerLocale.EnglishUs], takesName: false },
  { kind: CommandKind.RequestDeletion, locale: OwnerLocale.PortugueseBrazil, words: 'apagar conta', takesName: false },
  { kind: CommandKind.RequestDeletion, locale: OwnerLocale.EnglishUs, words: 'delete account', takesName: false },
  { kind: CommandKind.ConfirmDeletion, locale: OwnerLocale.PortugueseBrazil, words: 'apagar conta definitivamente', takesName: false },
  { kind: CommandKind.ConfirmDeletion, locale: OwnerLocale.EnglishUs, words: 'delete account permanently', takesName: false },
];

export const MENU_COMMAND_KINDS: readonly CommandKind[] = [
  CommandKind.CreateAgent,
  CommandKind.ListAgents,
  CommandKind.RevokeAgent,
  CommandKind.RotateAgent,
  CommandKind.Help,
  CommandKind.RequestDeletion,
];
