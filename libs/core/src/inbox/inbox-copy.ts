import { InboxCopyKey, OwnerLocale } from '@zapbip/types';
import type { MessageContent } from './message';

export const INBOX_COPY: Record<InboxCopyKey, Record<OwnerLocale, string>> = {
  [InboxCopyKey.RoutingPrompt]: {
    [OwnerLocale.PortugueseBrazil]: 'Para qual agente devo encaminhar sua mensagem?',
    [OwnerLocale.EnglishUs]: 'Which agent should I send your message to?',
  },
  [InboxCopyKey.NoAgents]: {
    [OwnerLocale.PortugueseBrazil]: 'Nenhum agente conectado. Sua mensagem ficou guardada.',
    [OwnerLocale.EnglishUs]: 'No agent is connected. Your message is saved.',
  },
  [InboxCopyKey.AgentNotListening]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} não está ouvindo agora. Sua mensagem espera no inbox.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} is not listening right now. Your message waits in the inbox.',
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

export function renderCopy(input: { key: InboxCopyKey; locale: OwnerLocale; values: Record<string, string> }): string;

export function renderCopy(input: { key: InboxCopyKey; locale: OwnerLocale; values: Record<string, string> }): string {
  void input;
  throw new Error('renderCopy is not implemented');
}

export function buildNoticePreview(input: { content: MessageContent; locale: OwnerLocale }): string {
  void input;
  throw new Error('buildNoticePreview is not implemented');
}
