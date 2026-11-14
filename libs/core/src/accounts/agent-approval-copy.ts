import { CommandKind, OwnerLocale } from '@zapbip/types';
import { fillCopyTokens } from '../inbox/inbox-copy';
import type { ApprovedCommandKind } from './use-cases/types';

export enum ApprovalChoice {
  Allow = 'allow',
  AllowAndSend = 'allow_and_send',
  Deny = 'deny',
}

const APPROVAL_TITLES: Record<OwnerLocale, Record<ApprovalChoice, string>> = {
  [OwnerLocale.PortugueseBrazil]: {
    [ApprovalChoice.Allow]: 'Permitir',
    [ApprovalChoice.AllowAndSend]: 'Enviar ao agente',
    [ApprovalChoice.Deny]: 'Negar',
  },
  [OwnerLocale.EnglishUs]: {
    [ApprovalChoice.Allow]: 'Allow',
    [ApprovalChoice.AllowAndSend]: 'Allow, send to agent',
    [ApprovalChoice.Deny]: 'Deny',
  },
  [OwnerLocale.Spanish]: {
    [ApprovalChoice.Allow]: 'Permitir',
    [ApprovalChoice.AllowAndSend]: 'Enviar al agente',
    [ApprovalChoice.Deny]: 'Denegar',
  },
  [OwnerLocale.German]: {
    [ApprovalChoice.Allow]: 'Erlauben',
    [ApprovalChoice.AllowAndSend]: 'An Agent senden',
    [ApprovalChoice.Deny]: 'Ablehnen',
  },
  [OwnerLocale.French]: {
    [ApprovalChoice.Allow]: 'Autoriser',
    [ApprovalChoice.AllowAndSend]: 'Envoyer à l’agent',
    [ApprovalChoice.Deny]: 'Refuser',
  },
  [OwnerLocale.Japanese]: {
    [ApprovalChoice.Allow]: '許可',
    [ApprovalChoice.AllowAndSend]: 'エージェントに送る',
    [ApprovalChoice.Deny]: '拒否',
  },
  [OwnerLocale.Korean]: {
    [ApprovalChoice.Allow]: '허용',
    [ApprovalChoice.AllowAndSend]: '에이전트에 전달',
    [ApprovalChoice.Deny]: '거부',
  },
  [OwnerLocale.ChineseSimplified]: {
    [ApprovalChoice.Allow]: '允许',
    [ApprovalChoice.AllowAndSend]: '发送给智能体',
    [ApprovalChoice.Deny]: '拒绝',
  },
};

const APPROVAL_QUESTIONS: Record<ApprovedCommandKind, Record<OwnerLocale, string>> = {
  [CommandKind.CreateAgent]: {
    [OwnerLocale.PortugueseBrazil]:
      '{requester} quer conectar um novo agente chamado {agent}. Permitir? "{allow}" envia o link de instalação para cá; "{allowAndSend}" entrega o link a {requester}. Ref {reference}.',
    [OwnerLocale.EnglishUs]:
      '{requester} wants to connect a new agent named {agent}. Allow? "{allow}" sends the install link here; "{allowAndSend}" hands it to {requester}. Ref {reference}.',
    [OwnerLocale.Spanish]:
      '{requester} quiere conectar un agente nuevo llamado {agent}. ¿Permitir? "{allow}" envía el enlace de instalación aquí; "{allowAndSend}" se lo entrega a {requester}. Ref {reference}.',
    [OwnerLocale.German]:
      '{requester} möchte einen neuen Agenten namens {agent} verbinden. Erlauben? „{allow}“ sendet den Installationslink hierher; „{allowAndSend}“ übergibt ihn an {requester}. Ref {reference}.',
    [OwnerLocale.French]:
      '{requester} veut connecter un nouvel agent nommé {agent}. Autoriser\u202f? «\u202f{allow}\u202f» envoie le lien d’installation ici\u202f; «\u202f{allowAndSend}\u202f» le remet à {requester}. Réf. {reference}.',
    [OwnerLocale.Japanese]:
      '{requester}が{agent}という新しいエージェントの接続を求めています。許可しますか？「{allow}」はインストールリンクをここに送り、「{allowAndSend}」は{requester}に渡します。参照 {reference}。',
    [OwnerLocale.Korean]:
      '{requester}이(가) {agent}이라는 새 에이전트의 연결을 요청해요. 허용할까요? "{allow}"은(는) 설치 링크를 여기로 보내고, "{allowAndSend}"은(는) {requester}에게 넘겨요. 참조 {reference}.',
    [OwnerLocale.ChineseSimplified]:
      '{requester} 想连接一个名为 {agent} 的新智能体。是否允许？“{allow}”会把安装链接发到这里；“{allowAndSend}”会把它交给 {requester}。编号 {reference}。',
  },
  [CommandKind.RevokeAgent]: {
    [OwnerLocale.PortugueseBrazil]: '{requester} quer revogar o agente {agent}. O link dele deixa de funcionar. Permitir? Ref {reference}.',
    [OwnerLocale.EnglishUs]: '{requester} wants to revoke the agent {agent}. Its link stops working. Allow? Ref {reference}.',
    [OwnerLocale.Spanish]: '{requester} quiere revocar el agente {agent}. Su enlace deja de funcionar. ¿Permitir? Ref {reference}.',
    [OwnerLocale.German]:
      '{requester} möchte den Agenten {agent} widerrufen. Sein Link funktioniert dann nicht mehr. Erlauben? Ref {reference}.',
    [OwnerLocale.French]: '{requester} veut révoquer l’agent {agent}. Son lien cesse de fonctionner. Autoriser\u202f? Réf. {reference}.',
    [OwnerLocale.Japanese]:
      '{requester}がエージェント{agent}の無効化を求めています。リンクは使えなくなります。許可しますか？参照 {reference}。',
    [OwnerLocale.Korean]:
      '{requester}이(가) 에이전트 {agent}의 폐기를 요청해요. 링크는 더 이상 작동하지 않아요. 허용할까요? 참조 {reference}.',
    [OwnerLocale.ChineseSimplified]: '{requester} 想撤销智能体 {agent}。它的链接将失效。是否允许？编号 {reference}。',
  },
};

export function approvalTitlesOf(input: { locale: OwnerLocale }): Record<ApprovalChoice, string> {
  return APPROVAL_TITLES[input.locale];
}

export function renderApprovalQuestion(input: {
  kind: ApprovedCommandKind;
  locale: OwnerLocale;
  requester: string;
  agent: string;
  reference: string;
}): string {
  const { kind, locale, requester, agent, reference } = input;
  const titles = approvalTitlesOf({ locale });
  return fillCopyTokens({
    text: APPROVAL_QUESTIONS[kind][locale],
    values: { requester, agent, reference, allow: titles[ApprovalChoice.Allow], allowAndSend: titles[ApprovalChoice.AllowAndSend] },
  });
}
