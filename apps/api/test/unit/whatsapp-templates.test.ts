import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';
import {
  OWNER_LOCALE_TO_LANGUAGE_CODE,
  WHATSAPP_TEMPLATE_BODIES,
  WHATSAPP_TEMPLATE_QUICK_REPLIES,
} from '../../src/adapters/whatsapp/whatsapp-templates';

describe('WhatsApp templates', () => {
  it('AU-116 keeps the registered template bodies', () => {
    expect(WHATSAPP_TEMPLATE_BODIES).toEqual({
      [WhatsAppTemplateName.AgentNotice]: {
        [WhatsAppLanguageCode.PortugueseBrazil]: 'Você tem uma mensagem de {{1}}: {{2}}. Toque em Abrir para ler.',
        [WhatsAppLanguageCode.EnglishUs]: 'You have a message from {{1}}: {{2}}. Tap Open to read it.',
      },
      [WhatsAppTemplateName.AgentQuestion]: {
        [WhatsAppLanguageCode.PortugueseBrazil]: '{{1}} tem uma pergunta para você: {{2}}. Toque em Responder para ver as opções.',
        [WhatsAppLanguageCode.EnglishUs]: '{{1}} has a question for you: {{2}}. Tap Reply to see the options.',
      },
    });
  });

  it('AU-116 keeps the quick reply texts', () => {
    expect(WHATSAPP_TEMPLATE_QUICK_REPLIES).toEqual({
      [WhatsAppTemplateName.AgentNotice]: { [WhatsAppLanguageCode.PortugueseBrazil]: 'Abrir', [WhatsAppLanguageCode.EnglishUs]: 'Open' },
      [WhatsAppTemplateName.AgentQuestion]: {
        [WhatsAppLanguageCode.PortugueseBrazil]: 'Responder',
        [WhatsAppLanguageCode.EnglishUs]: 'Reply',
      },
    });
  });

  it('AU-96 maps each owner locale to its language code', () => {
    expect(OWNER_LOCALE_TO_LANGUAGE_CODE).toEqual({
      [OwnerLocale.PortugueseBrazil]: WhatsAppLanguageCode.PortugueseBrazil,
      [OwnerLocale.EnglishUs]: WhatsAppLanguageCode.EnglishUs,
    });
    expect(Object.keys(OWNER_LOCALE_TO_LANGUAGE_CODE).sort()).toEqual(Object.values(OwnerLocale).sort());
  });
});
