import { OwnerLocale } from '@zapbip/types';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from './whatsapp-enums';

export const WHATSAPP_TEMPLATE_BODIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Você tem uma mensagem de {{1}}: {{2}}. Toque em Abrir para ler.',
    [WhatsAppLanguageCode.EnglishUs]: 'You have a message from {{1}}: {{2}}. Tap Open to read it.',
  },
  [WhatsAppTemplateName.AgentQuestion]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: '{{1}} tem uma pergunta para você: {{2}}. Toque em Responder para ver as opções.',
    [WhatsAppLanguageCode.EnglishUs]: '{{1}} has a question for you: {{2}}. Tap Reply to see the options.',
  },
};
export const WHATSAPP_TEMPLATE_QUICK_REPLIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: { [WhatsAppLanguageCode.PortugueseBrazil]: 'Abrir', [WhatsAppLanguageCode.EnglishUs]: 'Open' },
  [WhatsAppTemplateName.AgentQuestion]: { [WhatsAppLanguageCode.PortugueseBrazil]: 'Responder', [WhatsAppLanguageCode.EnglishUs]: 'Reply' },
};
export const OWNER_LOCALE_TO_LANGUAGE_CODE: Record<OwnerLocale, WhatsAppLanguageCode> = {
  [OwnerLocale.PortugueseBrazil]: WhatsAppLanguageCode.PortugueseBrazil,
  [OwnerLocale.EnglishUs]: WhatsAppLanguageCode.EnglishUs,
};
