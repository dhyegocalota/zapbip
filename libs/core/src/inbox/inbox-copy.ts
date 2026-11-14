import { InboxCopyKey, MessageKind, OwnerLocale } from '@zapbip/types';
import { NOTICE_PREVIEW_MAX_CHARS } from './constants';
import { invalidInput } from './inbox-error-factories';
import type { MessageContent } from './message';

export const INBOX_COPY: Record<InboxCopyKey, Record<OwnerLocale, string>> = {
  [InboxCopyKey.RoutingPrompt]: {
    [OwnerLocale.PortugueseBrazil]: 'Para qual agente devo encaminhar sua mensagem?',
    [OwnerLocale.EnglishUs]: 'Which agent should I send your message to?',
    [OwnerLocale.Spanish]: '¿A qué agente debo enviar tu mensaje?',
    [OwnerLocale.German]: 'An welchen Agenten soll ich deine Nachricht schicken?',
    [OwnerLocale.French]: 'À quel agent dois-je envoyer votre message\u202f?',
    [OwnerLocale.Japanese]: 'メッセージをどのエージェントに送りますか？',
    [OwnerLocale.Korean]: '메시지를 어느 에이전트에게 보낼까요?',
    [OwnerLocale.ChineseSimplified]: '要把你的消息发给哪个智能体？',
  },
  [InboxCopyKey.RoutingListExpired]: {
    [OwnerLocale.PortugueseBrazil]: 'Essa lista já foi usada.',
    [OwnerLocale.EnglishUs]: 'That list was already used.',
    [OwnerLocale.Spanish]: 'Esa lista ya se usó.',
    [OwnerLocale.German]: 'Diese Liste wurde schon verwendet.',
    [OwnerLocale.French]: 'Cette liste a déjà été utilisée.',
    [OwnerLocale.Japanese]: 'このリストはすでに使用済みです。',
    [OwnerLocale.Korean]: '이 목록은 이미 사용했어요.',
    [OwnerLocale.ChineseSimplified]: '这个列表已经用过了。',
  },
  [InboxCopyKey.RoutingListReminder]: {
    [OwnerLocale.PortugueseBrazil]: 'Escolha o agente na lista acima',
    [OwnerLocale.EnglishUs]: 'Pick the agent in the list above',
    [OwnerLocale.Spanish]: 'Elige el agente en la lista de arriba',
    [OwnerLocale.German]: 'Wähle den Agenten in der Liste oben',
    [OwnerLocale.French]: 'Choisissez l’agent dans la liste ci-dessus',
    [OwnerLocale.Japanese]: '上のリストからエージェントを選んでください',
    [OwnerLocale.Korean]: '위 목록에서 에이전트를 골라 주세요',
    [OwnerLocale.ChineseSimplified]: '请在上面的列表中选择智能体',
  },
  [InboxCopyKey.NoAgents]: {
    [OwnerLocale.PortugueseBrazil]: 'Nenhum agente conectado. Sua mensagem ficou guardada.',
    [OwnerLocale.EnglishUs]: 'No agent is connected. Your message is saved.',
    [OwnerLocale.Spanish]: 'No hay ningún agente conectado. Tu mensaje queda guardado.',
    [OwnerLocale.German]: 'Es ist kein Agent verbunden. Deine Nachricht ist gespeichert.',
    [OwnerLocale.French]: 'Aucun agent n’est connecté. Votre message est conservé.',
    [OwnerLocale.Japanese]: '接続されているエージェントがありません。メッセージは保管されています。',
    [OwnerLocale.Korean]: '연결된 에이전트가 없어요. 메시지는 저장되어 있어요.',
    [OwnerLocale.ChineseSimplified]: '没有已连接的智能体。你的消息已保存。',
  },
  [InboxCopyKey.AgentNotListening]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} não está ouvindo agora. Sua mensagem espera no inbox.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} is not listening right now. Your message waits in the inbox.',
    [OwnerLocale.Spanish]: 'El agente {agent} no está escuchando ahora. Tu mensaje espera en la bandeja de entrada.',
    [OwnerLocale.German]: 'Der Agent {agent} hört gerade nicht zu. Deine Nachricht wartet im Posteingang.',
    [OwnerLocale.French]: 'L’agent {agent} n’écoute pas pour le moment. Votre message attend dans la boîte de réception.',
    [OwnerLocale.Japanese]: 'エージェント{agent}は現在待ち受けていません。メッセージは受信箱で待機しています。',
    [OwnerLocale.Korean]: '에이전트 {agent}이(가) 지금은 듣고 있지 않아요. 메시지는 받은 편지함에서 기다려요.',
    [OwnerLocale.ChineseSimplified]: '智能体 {agent} 现在没有在监听。你的消息在收件箱里等候。',
  },
  [InboxCopyKey.AgentAssignedByExpiry]: {
    [OwnerLocale.PortugueseBrazil]: 'Você não escolheu um agente, então sua mensagem foi para {agent}. Ela espera no inbox.',
    [OwnerLocale.EnglishUs]: 'You did not pick an agent, so your message went to {agent}. It waits in the inbox.',
    [OwnerLocale.Spanish]: 'No elegiste un agente, así que tu mensaje fue a {agent}. Espera en la bandeja de entrada.',
    [OwnerLocale.German]: 'Du hast keinen Agenten gewählt, deshalb ging deine Nachricht an {agent}. Sie wartet im Posteingang.',
    [OwnerLocale.French]: 'Vous n’avez pas choisi d’agent, votre message est donc allé à {agent}. Il attend dans la boîte de réception.',
    [OwnerLocale.Japanese]: 'エージェントが選ばれなかったため、メッセージは{agent}に送られました。受信箱で待機しています。',
    [OwnerLocale.Korean]: '에이전트를 고르지 않아서 메시지가 {agent}에게 갔어요. 받은 편지함에서 기다려요.',
    [OwnerLocale.ChineseSimplified]: '你没有选择智能体，所以消息发给了 {agent}。它在收件箱里等候。',
  },
  [InboxCopyKey.NoticeBody]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} tem uma mensagem para você: {preview}',
    [OwnerLocale.EnglishUs]: 'The agent {agent} has a message for you: {preview}',
    [OwnerLocale.Spanish]: 'El agente {agent} tiene un mensaje para ti: {preview}',
    [OwnerLocale.German]: 'Der Agent {agent} hat eine Nachricht für dich: {preview}',
    [OwnerLocale.French]: 'L’agent {agent} a un message pour vous\u00a0: {preview}',
    [OwnerLocale.Japanese]: 'エージェント{agent}からメッセージです: {preview}',
    [OwnerLocale.Korean]: '에이전트 {agent}이(가) 메시지를 보냈어요: {preview}',
    [OwnerLocale.ChineseSimplified]: '智能体 {agent} 有一条消息给你：{preview}',
  },
  [InboxCopyKey.QuestionNoticeBody]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} tem uma pergunta para você: {preview}',
    [OwnerLocale.EnglishUs]: 'The agent {agent} has a question for you: {preview}',
    [OwnerLocale.Spanish]: 'El agente {agent} tiene una pregunta para ti: {preview}',
    [OwnerLocale.German]: 'Der Agent {agent} hat eine Frage an dich: {preview}',
    [OwnerLocale.French]: 'L’agent {agent} a une question pour vous\u00a0: {preview}',
    [OwnerLocale.Japanese]: 'エージェント{agent}から質問です: {preview}',
    [OwnerLocale.Korean]: '에이전트 {agent}이(가) 질문을 보냈어요: {preview}',
    [OwnerLocale.ChineseSimplified]: '智能体 {agent} 有一个问题要问你：{preview}',
  },
  [InboxCopyKey.NoticeQuickReply]: {
    [OwnerLocale.PortugueseBrazil]: 'Abrir',
    [OwnerLocale.EnglishUs]: 'Open',
    [OwnerLocale.Spanish]: 'Abrir',
    [OwnerLocale.German]: 'Öffnen',
    [OwnerLocale.French]: 'Ouvrir',
    [OwnerLocale.Japanese]: '開く',
    [OwnerLocale.Korean]: '열기',
    [OwnerLocale.ChineseSimplified]: '打开',
  },
  [InboxCopyKey.PreviewImage]: {
    [OwnerLocale.PortugueseBrazil]: '[imagem]',
    [OwnerLocale.EnglishUs]: '[image]',
    [OwnerLocale.Spanish]: '[imagen]',
    [OwnerLocale.German]: '[Bild]',
    [OwnerLocale.French]: '[image]',
    [OwnerLocale.Japanese]: '[画像]',
    [OwnerLocale.Korean]: '[이미지]',
    [OwnerLocale.ChineseSimplified]: '[图片]',
  },
  [InboxCopyKey.PreviewVideo]: {
    [OwnerLocale.PortugueseBrazil]: '[vídeo]',
    [OwnerLocale.EnglishUs]: '[video]',
    [OwnerLocale.Spanish]: '[vídeo]',
    [OwnerLocale.German]: '[Video]',
    [OwnerLocale.French]: '[vidéo]',
    [OwnerLocale.Japanese]: '[動画]',
    [OwnerLocale.Korean]: '[동영상]',
    [OwnerLocale.ChineseSimplified]: '[视频]',
  },
  [InboxCopyKey.PreviewAudio]: {
    [OwnerLocale.PortugueseBrazil]: '[áudio]',
    [OwnerLocale.EnglishUs]: '[audio]',
    [OwnerLocale.Spanish]: '[audio]',
    [OwnerLocale.German]: '[Audio]',
    [OwnerLocale.French]: '[audio]',
    [OwnerLocale.Japanese]: '[音声]',
    [OwnerLocale.Korean]: '[오디오]',
    [OwnerLocale.ChineseSimplified]: '[音频]',
  },
  [InboxCopyKey.PreviewVoice]: {
    [OwnerLocale.PortugueseBrazil]: '[mensagem de voz]',
    [OwnerLocale.EnglishUs]: '[voice note]',
    [OwnerLocale.Spanish]: '[nota de voz]',
    [OwnerLocale.German]: '[Sprachnachricht]',
    [OwnerLocale.French]: '[message vocal]',
    [OwnerLocale.Japanese]: '[ボイスメッセージ]',
    [OwnerLocale.Korean]: '[음성 메시지]',
    [OwnerLocale.ChineseSimplified]: '[语音消息]',
  },
  [InboxCopyKey.PreviewDocument]: {
    [OwnerLocale.PortugueseBrazil]: '[documento]',
    [OwnerLocale.EnglishUs]: '[document]',
    [OwnerLocale.Spanish]: '[documento]',
    [OwnerLocale.German]: '[Dokument]',
    [OwnerLocale.French]: '[document]',
    [OwnerLocale.Japanese]: '[ドキュメント]',
    [OwnerLocale.Korean]: '[문서]',
    [OwnerLocale.ChineseSimplified]: '[文档]',
  },
  [InboxCopyKey.PreviewSticker]: {
    [OwnerLocale.PortugueseBrazil]: '[figurinha]',
    [OwnerLocale.EnglishUs]: '[sticker]',
    [OwnerLocale.Spanish]: '[sticker]',
    [OwnerLocale.German]: '[Sticker]',
    [OwnerLocale.French]: '[sticker]',
    [OwnerLocale.Japanese]: '[スタンプ]',
    [OwnerLocale.Korean]: '[스티커]',
    [OwnerLocale.ChineseSimplified]: '[贴纸]',
  },
  [InboxCopyKey.PreviewReaction]: {
    [OwnerLocale.PortugueseBrazil]: '[reação]',
    [OwnerLocale.EnglishUs]: '[reaction]',
    [OwnerLocale.Spanish]: '[reacción]',
    [OwnerLocale.German]: '[Reaktion]',
    [OwnerLocale.French]: '[réaction]',
    [OwnerLocale.Japanese]: '[リアクション]',
    [OwnerLocale.Korean]: '[반응]',
    [OwnerLocale.ChineseSimplified]: '[回应]',
  },
  [InboxCopyKey.PreviewLocation]: {
    [OwnerLocale.PortugueseBrazil]: '[localização]',
    [OwnerLocale.EnglishUs]: '[location]',
    [OwnerLocale.Spanish]: '[ubicación]',
    [OwnerLocale.German]: '[Standort]',
    [OwnerLocale.French]: '[position]',
    [OwnerLocale.Japanese]: '[位置情報]',
    [OwnerLocale.Korean]: '[위치]',
    [OwnerLocale.ChineseSimplified]: '[位置]',
  },
  [InboxCopyKey.PreviewContacts]: {
    [OwnerLocale.PortugueseBrazil]: '[contato]',
    [OwnerLocale.EnglishUs]: '[contact]',
    [OwnerLocale.Spanish]: '[contacto]',
    [OwnerLocale.German]: '[Kontakt]',
    [OwnerLocale.French]: '[contact]',
    [OwnerLocale.Japanese]: '[連絡先]',
    [OwnerLocale.Korean]: '[연락처]',
    [OwnerLocale.ChineseSimplified]: '[联系人]',
  },
  [InboxCopyKey.PreviewChoice]: {
    [OwnerLocale.PortugueseBrazil]: '[resposta]',
    [OwnerLocale.EnglishUs]: '[answer]',
    [OwnerLocale.Spanish]: '[respuesta]',
    [OwnerLocale.German]: '[Antwort]',
    [OwnerLocale.French]: '[réponse]',
    [OwnerLocale.Japanese]: '[回答]',
    [OwnerLocale.Korean]: '[답변]',
    [OwnerLocale.ChineseSimplified]: '[回答]',
  },
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
