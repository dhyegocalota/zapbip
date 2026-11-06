import { OwnerLocale, TemplateKind } from '@zapbip/types';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from './whatsapp-enums';

export const WHATSAPP_TEMPLATE_BODIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Mensagem de {{1}}: {{2}} — toque em Abrir para ler.',
    [WhatsAppLanguageCode.EnglishUs]: 'Message from {{1}}: {{2}} — tap Open to read it.',
  },
  [WhatsAppTemplateName.AgentQuestion]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Pergunta de {{1}}: {{2}} — toque em Responder para ver as opções.',
    [WhatsAppLanguageCode.EnglishUs]: 'Question from {{1}}: {{2}} — tap Reply to see the options.',
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
export const TEMPLATE_NAME_BY_KIND: Record<TemplateKind, WhatsAppTemplateName> = {
  [TemplateKind.Notice]: WhatsAppTemplateName.AgentNotice,
  [TemplateKind.QuestionNotice]: WhatsAppTemplateName.AgentQuestion,
};
