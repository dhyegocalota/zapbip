import { CommandKind, OwnerLocale, START_PREFILLED_TEXT } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { parseAccountCommand } from './command';

function parseText(input: { text: string; isQuoting?: boolean }) {
  return parseAccountCommand({ text: input.text, listReplyId: null, isQuoting: input.isQuoting === true, locale: OwnerLocale.EnglishUs });
}

function parseListReply(input: { listReplyId: string | null; text?: string | null; locale?: OwnerLocale }) {
  return parseAccountCommand({
    text: input.text === undefined ? null : input.text,
    listReplyId: input.listReplyId,
    isQuoting: false,
    locale: input.locale === undefined ? OwnerLocale.EnglishUs : input.locale,
  });
}

describe('parseAccountCommand on the start link text', () => {
  test.each(Object.values(OwnerLocale))('reads the prefilled text of %s as no command', (locale) => {
    expect(parseAccountCommand({ text: START_PREFILLED_TEXT[locale], listReplyId: null, isQuoting: false, locale })).toBeNull();
  });
});

describe('parseAccountCommand text', () => {
  test.each([
    ['agentes', CommandKind.ListAgents, OwnerLocale.PortugueseBrazil],
    ['agents', CommandKind.ListAgents, OwnerLocale.EnglishUs],
    ['  AGENTES  ', CommandKind.ListAgents, OwnerLocale.PortugueseBrazil],
    ['ajuda', CommandKind.Help, OwnerLocale.PortugueseBrazil],
    ['menu', CommandKind.Help, OwnerLocale.EnglishUs],
    ['help', CommandKind.Help, OwnerLocale.EnglishUs],
    ['apagar conta', CommandKind.RequestDeletion, OwnerLocale.PortugueseBrazil],
    ['delete account', CommandKind.RequestDeletion, OwnerLocale.EnglishUs],
    ['apagar conta definitivamente', CommandKind.ConfirmDeletion, OwnerLocale.PortugueseBrazil],
    ['Delete   Account   Permanently', CommandKind.ConfirmDeletion, OwnerLocale.EnglishUs],
    ['login', CommandKind.Login, OwnerLocale.EnglishUs],
    ['  ENTRAR ', CommandKind.Login, OwnerLocale.PortugueseBrazil],
  ])('matches %j', (text, kind, locale) => {
    expect(parseText({ text })).toEqual({ kind, rawName: null, locale });
  });

  test.each(['agentes?', 'agentes.', 'ajuda!', 'apagar conta definitivamente.', 'apagar', 'novo', 'oi', '', 'login?', 'entrar agora'])(
    'leaves %j as a message',
    (text) => {
      expect(parseText({ text })).toBeNull();
    },
  );

  test.each([
    ['Novo    Agente   Claude Code', CommandKind.CreateAgent, 'Claude Code', OwnerLocale.PortugueseBrazil],
    ['new agent Claude Code', CommandKind.CreateAgent, 'Claude Code', OwnerLocale.EnglishUs],
    ['novo agente', CommandKind.CreateAgent, '', OwnerLocale.PortugueseBrazil],
    ['novo agente    ', CommandKind.CreateAgent, '', OwnerLocale.PortugueseBrazil],
    ['revogar', CommandKind.RevokeAgent, '', OwnerLocale.PortugueseBrazil],
    ['revoke claude', CommandKind.RevokeAgent, 'claude', OwnerLocale.EnglishUs],
    ['renovar a imagem', CommandKind.RotateAgent, 'a imagem', OwnerLocale.PortugueseBrazil],
    ['renovar   Foo', CommandKind.RotateAgent, 'Foo', OwnerLocale.PortugueseBrazil],
    ['rotate', CommandKind.RotateAgent, '', OwnerLocale.EnglishUs],
  ])('matches %j with a name', (text, kind, rawName, locale) => {
    expect(parseText({ text })).toEqual({ kind, rawName, locale });
  });

  test.each(['novo agente', 'agentes'])('leaves the quoting message %j to the quoted agent', (text) => {
    expect(parseText({ text, isQuoting: true })).toBeNull();
  });
});

describe('parseAccountCommand list replies', () => {
  test.each([
    ['zapbip:create_agent', CommandKind.CreateAgent],
    ['zapbip:list_agents', CommandKind.ListAgents],
    ['zapbip:revoke_agent', CommandKind.RevokeAgent],
    ['zapbip:rotate_agent', CommandKind.RotateAgent],
    ['zapbip:help', CommandKind.Help],
    ['zapbip:request_deletion', CommandKind.RequestDeletion],
  ])('maps %s to a menu command', (listReplyId, kind) => {
    expect(parseListReply({ listReplyId })).toMatchObject({ kind, rawName: null });
  });

  test('answers a menu choice in the locale of the account', () => {
    expect(parseListReply({ listReplyId: 'zapbip:help', locale: OwnerLocale.Japanese })).toMatchObject({
      kind: CommandKind.Help,
      locale: OwnerLocale.Japanese,
    });
  });

  test.each(['zapbip:bogus', 'zapbip:confirm_deletion', 'zapbip:unknown', 'zapbip:'])('maps %s to the unknown command', (listReplyId) => {
    expect(parseListReply({ listReplyId })).toMatchObject({ kind: CommandKind.Unknown, rawName: null });
  });

  test('leaves a question answer to rule 1', () => {
    expect(parseListReply({ listReplyId: 'q_abc123:1' })).toBeNull();
  });

  test('never reads a reaction or media as a command', () => {
    expect(parseListReply({ listReplyId: null })).toBeNull();
  });

  test('lets the list reply win over the text', () => {
    expect(parseListReply({ listReplyId: 'q_abc123:1', text: 'ajuda' })).toBeNull();
  });
});
