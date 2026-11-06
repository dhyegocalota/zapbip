import { AccountReplyIntent, CommandKind, OwnerLocale } from '@zapbip/types';
import { invalidInput } from '../inbox/inbox-error-factories';
import type { AccountReply, MenuRow } from './account-types';
import { formatMenuRowId } from './command';
import { MENU_COMMAND_KINDS } from './command-words';

type LocalizedText = Record<OwnerLocale, string>;

const COPY_TOKEN_PATTERN = /\{(\w+)\}/g;

const ACCOUNT_COPY: Record<AccountReplyIntent, LocalizedText> = {
  [AccountReplyIntent.Waitlisted]: {
    [OwnerLocale.PortugueseBrazil]: 'Você está na lista de espera. Envie "ajuda" quando o acesso abrir.',
    [OwnerLocale.EnglishUs]: 'You are on the waitlist. Send "help" when access opens.',
  },
  [AccountReplyIntent.Suspended]: {
    [OwnerLocale.PortugueseBrazil]: 'Sua conta está suspensa.',
    [OwnerLocale.EnglishUs]: 'Your account is suspended.',
  },
  [AccountReplyIntent.Created]: {
    [OwnerLocale.PortugueseBrazil]:
      'Agente {agent_name} criado. Cole as instruções abaixo no seu agente:\n\n{install_prompt}\n\nO link é uma senha: quem o tiver controla este agente. Se vazar, envie "girar {agent_name}".',
    [OwnerLocale.EnglishUs]:
      'Agent {agent_name} created. Paste the instructions below into your agent:\n\n{install_prompt}\n\nThe link is a password: anyone who has it controls this agent. If it leaks, send "rotate {agent_name}".',
  },
  [AccountReplyIntent.InvalidName]: {
    [OwnerLocale.PortugueseBrazil]: 'Nome inválido. Use de 1 a 20 letras minúsculas, números ou hífens, começando por letra ou número.',
    [OwnerLocale.EnglishUs]: 'Invalid name. Use 1 to 20 lowercase letters, numbers or hyphens, starting with a letter or number.',
  },
  [AccountReplyIntent.ReservedName]: {
    [OwnerLocale.PortugueseBrazil]: 'Esse nome é reservado porque é o início de um comando. Escolha outro.',
    [OwnerLocale.EnglishUs]: 'That name is reserved because it starts a command. Choose another one.',
  },
  [AccountReplyIntent.NameTaken]: {
    [OwnerLocale.PortugueseBrazil]: 'Já existe um agente chamado {agent_name}.',
    [OwnerLocale.EnglishUs]: 'An agent named {agent_name} already exists.',
  },
  [AccountReplyIntent.LimitReached]: {
    [OwnerLocale.PortugueseBrazil]: 'Limite de {limit} agentes atingido. Envie "revogar <nome>" para liberar uma vaga.',
    [OwnerLocale.EnglishUs]: 'Limit of {limit} agents reached. Send "revoke <name>" to free a slot.',
  },
  [AccountReplyIntent.NotFound]: {
    [OwnerLocale.PortugueseBrazil]: 'Nenhum agente ativo tem esse nome.',
    [OwnerLocale.EnglishUs]: 'No active agent has that name.',
  },
  [AccountReplyIntent.Revoked]: {
    [OwnerLocale.PortugueseBrazil]: 'Agente {agent_name} revogado. O link deixou de funcionar.',
    [OwnerLocale.EnglishUs]: 'Agent {agent_name} revoked. Its link no longer works.',
  },
  [AccountReplyIntent.Rotated]: {
    [OwnerLocale.PortugueseBrazil]:
      'Link do agente {agent_name} trocado. O link antigo deixou de funcionar. Cole as novas instruções no seu agente:\n\n{install_prompt}\n\nO link é uma senha: quem o tiver controla este agente.',
    [OwnerLocale.EnglishUs]:
      'Link of agent {agent_name} replaced. The old link no longer works. Paste the new instructions into your agent:\n\n{install_prompt}\n\nThe link is a password: anyone who has it controls this agent.',
  },
  [AccountReplyIntent.Listed]: {
    [OwnerLocale.PortugueseBrazil]: 'Seus agentes:\n{agents}',
    [OwnerLocale.EnglishUs]: 'Your agents:\n{agents}',
  },
  [AccountReplyIntent.EmptyList]: {
    [OwnerLocale.PortugueseBrazil]: 'Você ainda não tem agentes. Envie "novo agente <nome>" para criar um.',
    [OwnerLocale.EnglishUs]: 'You have no agents yet. Send "new agent <name>" to create one.',
  },
  [AccountReplyIntent.Usage]: {
    [OwnerLocale.PortugueseBrazil]: 'Use: {usage}',
    [OwnerLocale.EnglishUs]: 'Use: {usage}',
  },
  [AccountReplyIntent.Menu]: {
    [OwnerLocale.PortugueseBrazil]: 'O que você quer fazer?',
    [OwnerLocale.EnglishUs]: 'What do you want to do?',
  },
  [AccountReplyIntent.DeletionRequest]: {
    [OwnerLocale.PortugueseBrazil]:
      'Isso apaga sua conta, todos os agentes, mensagens e arquivos, e não tem volta. Para confirmar em até 10 minutos, envie: {phrase}',
    [OwnerLocale.EnglishUs]:
      'This deletes your account, every agent, message and file, and cannot be undone. To confirm within 10 minutes, send: {phrase}',
  },
  [AccountReplyIntent.DeletionExpired]: {
    [OwnerLocale.PortugueseBrazil]: 'Não há pedido de exclusão válido. Envie "apagar conta" para começar de novo.',
    [OwnerLocale.EnglishUs]: 'There is no valid deletion request. Send "delete account" to start again.',
  },
  [AccountReplyIntent.DeletionDone]: {
    [OwnerLocale.PortugueseBrazil]: 'Sua conta foi apagada. A próxima mensagem começa uma nova conta.',
    [OwnerLocale.EnglishUs]: 'Your account is deleted. Your next message starts a new account.',
  },
  [AccountReplyIntent.SendFailed]: {
    [OwnerLocale.PortugueseBrazil]: 'Não consegui entregar as instruções. Nada foi alterado; tente de novo.',
    [OwnerLocale.EnglishUs]: 'I could not deliver the instructions. Nothing was changed; try again.',
  },
  [AccountReplyIntent.Unknown]: {
    [OwnerLocale.PortugueseBrazil]: 'Não entendi. Envie "ajuda" para ver os comandos.',
    [OwnerLocale.EnglishUs]: 'I did not understand. Send "help" to see the commands.',
  },
};

const MENU_ROW_TITLES: Partial<Record<CommandKind, LocalizedText>> = {
  [CommandKind.CreateAgent]: { [OwnerLocale.PortugueseBrazil]: 'Novo agente', [OwnerLocale.EnglishUs]: 'New agent' },
  [CommandKind.ListAgents]: { [OwnerLocale.PortugueseBrazil]: 'Meus agentes', [OwnerLocale.EnglishUs]: 'My agents' },
  [CommandKind.RevokeAgent]: { [OwnerLocale.PortugueseBrazil]: 'Revogar agente', [OwnerLocale.EnglishUs]: 'Revoke agent' },
  [CommandKind.RotateAgent]: { [OwnerLocale.PortugueseBrazil]: 'Girar link', [OwnerLocale.EnglishUs]: 'Rotate link' },
  [CommandKind.Help]: { [OwnerLocale.PortugueseBrazil]: 'Ajuda', [OwnerLocale.EnglishUs]: 'Help' },
  [CommandKind.RequestDeletion]: { [OwnerLocale.PortugueseBrazil]: 'Apagar conta', [OwnerLocale.EnglishUs]: 'Delete account' },
};

const MENU_BUTTON_TEXT: LocalizedText = {
  [OwnerLocale.PortugueseBrazil]: 'Comandos',
  [OwnerLocale.EnglishUs]: 'Commands',
};

export function renderAccountReply(input: { reply: AccountReply }): string {
  const parameters: Record<string, string | undefined> = input.reply.parameters;
  return ACCOUNT_COPY[input.reply.intent][input.reply.locale].replace(COPY_TOKEN_PATTERN, (_token, name: string) => {
    const value = parameters[name];
    if (value === undefined) throw invalidInput({ message: `copy: missing parameter ${name}` });
    return value;
  });
}

export function buildMenuRows(input: { locale: OwnerLocale }): MenuRow[] {
  return MENU_COMMAND_KINDS.map((kind) => {
    const titles = MENU_ROW_TITLES[kind];
    if (titles === undefined) throw invalidInput({ message: `menu: no title for ${kind}` });
    return { id: formatMenuRowId({ kind }), title: titles[input.locale] };
  });
}

export function buildMenuButtonText(input: { locale: OwnerLocale }): string {
  return MENU_BUTTON_TEXT[input.locale];
}

export function renderInstallLines(_input: { installLink: string; locale: OwnerLocale }): string {
  throw new Error('renderInstallLines is not implemented');
}
