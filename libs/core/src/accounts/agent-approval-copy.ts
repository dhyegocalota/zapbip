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
};

const APPROVAL_QUESTIONS: Record<ApprovedCommandKind, Record<OwnerLocale, string>> = {
  [CommandKind.CreateAgent]: {
    [OwnerLocale.PortugueseBrazil]:
      '{requester} quer conectar um novo agente chamado {agent}. Permitir? "{allow}" envia o link de instalação para cá; "{allowAndSend}" entrega o link a {requester}. Ref {reference}.',
    [OwnerLocale.EnglishUs]:
      '{requester} wants to connect a new agent named {agent}. Allow? "{allow}" sends the install link here; "{allowAndSend}" hands it to {requester}. Ref {reference}.',
  },
  [CommandKind.RevokeAgent]: {
    [OwnerLocale.PortugueseBrazil]: '{requester} quer revogar o agente {agent}. O link dele deixa de funcionar. Permitir? Ref {reference}.',
    [OwnerLocale.EnglishUs]: '{requester} wants to revoke the agent {agent}. Its link stops working. Allow? Ref {reference}.',
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
