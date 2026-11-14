import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import {
  OUTBOUND_LIST_BUTTON_LABEL_MAX_CHARS,
  OUTBOUND_LIST_SECTION_TITLE_MAX_CHARS,
} from '../../src/adapters/whatsapp/whatsapp-constants';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';

const LOCALES = Object.values(OwnerLocale);
const COPY_KEYS = Object.values(OwnerCopyKey);

describe('WHATSAPP_COPY', () => {
  it('AU-118 holds every key in both locales, non-empty', () => {
    LOCALES.forEach((locale) => COPY_KEYS.forEach((key) => expect(WHATSAPP_COPY[locale][key].length).toBeGreaterThan(0)));
  });

  it('AU-118 states the unsupported kind and the unavailable media as the spec does', () => {
    expect(WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.UnsupportedKind]).toBe(
      'Este tipo de mensagem ainda não tem suporte. Envie como texto ou foto.',
    );
    expect(WHATSAPP_COPY[OwnerLocale.EnglishUs][OwnerCopyKey.UnsupportedKind]).toBe(
      'This kind of message is not supported yet. Send it as text or a photo.',
    );
    expect(WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.MediaUnavailable]).toBe(
      'Não consegui baixar o arquivo. Envie de novo, por favor.',
    );
    expect(WHATSAPP_COPY[OwnerLocale.EnglishUs][OwnerCopyKey.MediaUnavailable]).toBe(
      'I could not download the file. Please send it again.',
    );
  });

  it('AU-119 keeps the list button label within the Meta limit', () => {
    LOCALES.forEach((locale) =>
      expect(WHATSAPP_COPY[locale][OwnerCopyKey.ListButtonLabel].length).toBeLessThanOrEqual(OUTBOUND_LIST_BUTTON_LABEL_MAX_CHARS),
    );
  });

  it('AU-120 keeps the list section title within the Meta limit', () => {
    LOCALES.forEach((locale) =>
      expect(WHATSAPP_COPY[locale][OwnerCopyKey.ListSectionTitle].length).toBeLessThanOrEqual(OUTBOUND_LIST_SECTION_TITLE_MAX_CHARS),
    );
  });
});
