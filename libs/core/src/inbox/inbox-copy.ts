import { InboxCopyKey, MessageKind, OwnerLocale } from '@zapbip/types';
import { NOTICE_PREVIEW_MAX_CHARS } from './constants';
import { invalidInput } from './inbox-error-factories';
import type { MessageContent } from './message';

export const INBOX_COPY: Record<InboxCopyKey, Record<OwnerLocale, string>> = {
  [InboxCopyKey.RoutingPrompt]: {
    [OwnerLocale.PortugueseBrazil]: 'Para qual agente devo encaminhar sua mensagem?',
    [OwnerLocale.EnglishUs]: 'Which agent should I send your message to?',
  },
  [InboxCopyKey.RoutingListExpired]: {
    [OwnerLocale.PortugueseBrazil]: 'Essa lista já foi usada.',
    [OwnerLocale.EnglishUs]: 'That list was already used.',
  },
  [InboxCopyKey.RoutingListReminder]: {
    [OwnerLocale.PortugueseBrazil]: 'Escolha o agente na lista acima',
    [OwnerLocale.EnglishUs]: 'Pick the agent in the list above',
  },
  [InboxCopyKey.NoAgents]: {
    [OwnerLocale.PortugueseBrazil]: 'Nenhum agente conectado. Sua mensagem ficou guardada.',
    [OwnerLocale.EnglishUs]: 'No agent is connected. Your message is saved.',
  },
  [InboxCopyKey.AgentNotListening]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} não está ouvindo agora. Sua mensagem espera no inbox.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} is not listening right now. Your message waits in the inbox.',
  },
  [InboxCopyKey.AgentAssignedByExpiry]: {
    [OwnerLocale.PortugueseBrazil]: 'Você não escolheu um agente, então sua mensagem foi para {agent}. Ela espera no inbox.',
    [OwnerLocale.EnglishUs]: 'You did not pick an agent, so your message went to {agent}. It waits in the inbox.',
  },
  [InboxCopyKey.NoticeBody]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} tem uma mensagem para você: {preview}',
    [OwnerLocale.EnglishUs]: 'The agent {agent} has a message for you: {preview}',
  },
  [InboxCopyKey.QuestionNoticeBody]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} tem uma pergunta para você: {preview}',
    [OwnerLocale.EnglishUs]: 'The agent {agent} has a question for you: {preview}',
  },
  [InboxCopyKey.NoticeQuickReply]: {
    [OwnerLocale.PortugueseBrazil]: 'Abrir',
    [OwnerLocale.EnglishUs]: 'Open',
  },
  [InboxCopyKey.PreviewImage]: { [OwnerLocale.PortugueseBrazil]: '[imagem]', [OwnerLocale.EnglishUs]: '[image]' },
  [InboxCopyKey.PreviewVideo]: { [OwnerLocale.PortugueseBrazil]: '[vídeo]', [OwnerLocale.EnglishUs]: '[video]' },
  [InboxCopyKey.PreviewAudio]: { [OwnerLocale.PortugueseBrazil]: '[áudio]', [OwnerLocale.EnglishUs]: '[audio]' },
  [InboxCopyKey.PreviewVoice]: { [OwnerLocale.PortugueseBrazil]: '[mensagem de voz]', [OwnerLocale.EnglishUs]: '[voice note]' },
  [InboxCopyKey.PreviewDocument]: { [OwnerLocale.PortugueseBrazil]: '[documento]', [OwnerLocale.EnglishUs]: '[document]' },
  [InboxCopyKey.PreviewSticker]: { [OwnerLocale.PortugueseBrazil]: '[figurinha]', [OwnerLocale.EnglishUs]: '[sticker]' },
  [InboxCopyKey.PreviewReaction]: { [OwnerLocale.PortugueseBrazil]: '[reação]', [OwnerLocale.EnglishUs]: '[reaction]' },
  [InboxCopyKey.PreviewLocation]: { [OwnerLocale.PortugueseBrazil]: '[localização]', [OwnerLocale.EnglishUs]: '[location]' },
  [InboxCopyKey.PreviewContacts]: { [OwnerLocale.PortugueseBrazil]: '[contato]', [OwnerLocale.EnglishUs]: '[contact]' },
  [InboxCopyKey.PreviewChoice]: { [OwnerLocale.PortugueseBrazil]: '[resposta]', [OwnerLocale.EnglishUs]: '[answer]' },
};

const COPY_TOKEN_PATTERN = /\{(\w+)\}/g;
const WHITESPACE_PATTERN = /\s+/g;
const TRUNCATION_MARK = '…';

type PreviewedKind = Exclude<MessageKind, MessageKind.Text | MessageKind.Audio>;

const PREVIEW_KEYS: Record<PreviewedKind, InboxCopyKey> = {
  [MessageKind.Image]: InboxCopyKey.PreviewImage,
  [MessageKind.Video]: InboxCopyKey.PreviewVideo,
  [MessageKind.Document]: InboxCopyKey.PreviewDocument,
  [MessageKind.Sticker]: InboxCopyKey.PreviewSticker,
  [MessageKind.Location]: InboxCopyKey.PreviewLocation,
  [MessageKind.Contacts]: InboxCopyKey.PreviewContacts,
  [MessageKind.Reaction]: InboxCopyKey.PreviewReaction,
  [MessageKind.Choice]: InboxCopyKey.PreviewChoice,
};

export function fillCopyTokens(input: { text: string; values: Record<string, string> }): string {
  return input.text.replace(COPY_TOKEN_PATTERN, (_token, name: string) => {
    const value = input.values[name];
    if (value === undefined) throw invalidInput({ message: `copy: missing value for ${name}` });
    return value;
  });
}

export function renderCopy(input: { key: InboxCopyKey; locale: OwnerLocale; values: Record<string, string> }): string {
  return fillCopyTokens({ text: INBOX_COPY[input.key][input.locale], values: input.values });
}

function truncatePreview(input: { text: string }): string {
  const characters = [...input.text.replace(WHITESPACE_PATTERN, ' ').trim()];
  if (characters.length <= NOTICE_PREVIEW_MAX_CHARS) return characters.join('');
  return `${characters.slice(0, NOTICE_PREVIEW_MAX_CHARS - TRUNCATION_MARK.length).join('')}${TRUNCATION_MARK}`;
}

function previewKeyOf(input: { content: Exclude<MessageContent, { kind: MessageKind.Text }> }): InboxCopyKey {
  if (input.content.kind === MessageKind.Audio) return input.content.voice ? InboxCopyKey.PreviewVoice : InboxCopyKey.PreviewAudio;
  return PREVIEW_KEYS[input.content.kind];
}

export function buildNoticePreview(input: { content: MessageContent; locale: OwnerLocale }): string {
  if (input.content.kind === MessageKind.Text) return truncatePreview({ text: input.content.text });
  return renderCopy({ key: previewKeyOf({ content: input.content }), locale: input.locale, values: {} });
}
