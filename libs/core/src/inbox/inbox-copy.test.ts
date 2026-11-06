import { InboxCopyKey, InboxErrorCode, MediaSourceKind, MessageKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NOTICE_PREVIEW_MAX_CHARS } from './constants';
import { buildNoticePreview, INBOX_COPY, renderCopy } from './inbox-copy';
import { captureInboxError } from './testing/capture-inbox-error';

describe('INBOX_COPY', () => {
  test('CU-89 pin: every key has text in both locales', () => {
    Object.values(InboxCopyKey).forEach((key) =>
      Object.values(OwnerLocale).forEach((locale) => expect(INBOX_COPY[key][locale].length).toBeGreaterThan(0)),
    );
  });
});

describe('renderCopy', () => {
  test('CU-90 fills a token', () => {
    const text = renderCopy({ key: InboxCopyKey.AgentNotListening, locale: OwnerLocale.PortugueseBrazil, values: { agent: 'alpha' } });
    expect(text).toBe('O agente alpha não está ouvindo agora. Sua mensagem espera no inbox.');
  });

  test('CU-91 a missing token', async () => {
    const error = await captureInboxError(() =>
      renderCopy({ key: InboxCopyKey.AgentNotListening, locale: OwnerLocale.EnglishUs, values: {} }),
    );
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'copy: missing value for agent' });
  });

  test('the expiry assignment names the agent that got the batch', () => {
    const values = { agent: 'beta' };
    expect(renderCopy({ key: InboxCopyKey.AgentAssignedByExpiry, locale: OwnerLocale.PortugueseBrazil, values })).toBe(
      'Você não escolheu um agente, então sua mensagem foi para beta. Ela espera no inbox.',
    );
    expect(renderCopy({ key: InboxCopyKey.AgentAssignedByExpiry, locale: OwnerLocale.EnglishUs, values })).toBe(
      'You did not pick an agent, so your message went to beta. It waits in the inbox.',
    );
  });

  test('CU-92 in English', () => {
    expect(renderCopy({ key: InboxCopyKey.NoticeQuickReply, locale: OwnerLocale.EnglishUs, values: {} })).toBe('Open');
  });
});

describe('buildNoticePreview', () => {
  test('keeps a short text', () => {
    expect(buildNoticePreview({ content: { kind: MessageKind.Text, text: 'deploy ready' }, locale: OwnerLocale.EnglishUs })).toBe(
      'deploy ready',
    );
  });

  test('removes newlines and caps the length', () => {
    const text = `line one\nline two ${'x'.repeat(100)}`;
    const preview = buildNoticePreview({ content: { kind: MessageKind.Text, text }, locale: OwnerLocale.EnglishUs });
    expect(preview).not.toContain('\n');
    expect([...preview].length).toBeLessThanOrEqual(NOTICE_PREVIEW_MAX_CHARS);
  });

  test('names a media kind in the owner locale', () => {
    const content = {
      kind: MessageKind.Image as const,
      source: { kind: MediaSourceKind.Link as const, link: 'https://example.com/a.jpg' },
      mimeType: null,
      sizeBytes: null,
      filename: null,
      caption: null,
    };
    expect(buildNoticePreview({ content, locale: OwnerLocale.PortugueseBrazil })).toBe('[imagem]');
  });

  test('tells a voice note from audio', () => {
    const fields = {
      source: { kind: MediaSourceKind.Link as const, link: 'https://example.com/a.ogg' },
      mimeType: null,
      sizeBytes: null,
      filename: null,
      caption: null,
    };
    expect(buildNoticePreview({ content: { kind: MessageKind.Audio, voice: true, ...fields }, locale: OwnerLocale.EnglishUs })).toBe(
      '[voice note]',
    );
    expect(buildNoticePreview({ content: { kind: MessageKind.Audio, voice: false, ...fields }, locale: OwnerLocale.EnglishUs })).toBe(
      '[audio]',
    );
  });
});

describe('routing list copy', () => {
  test('a used list is answered in both locales', () => {
    expect(renderCopy({ key: InboxCopyKey.RoutingListExpired, locale: OwnerLocale.PortugueseBrazil, values: {} })).toBe(
      'Essa lista já foi usada.',
    );
    expect(renderCopy({ key: InboxCopyKey.RoutingListExpired, locale: OwnerLocale.EnglishUs, values: {} })).toBe(
      'That list was already used.',
    );
  });

  test('pin: the reminder points at the list above in both locales', () => {
    expect(renderCopy({ key: InboxCopyKey.RoutingListReminder, locale: OwnerLocale.PortugueseBrazil, values: {} })).toBe(
      'Escolha o agente na lista acima',
    );
    expect(renderCopy({ key: InboxCopyKey.RoutingListReminder, locale: OwnerLocale.EnglishUs, values: {} })).toBe(
      'Pick the agent in the list above',
    );
  });
});
