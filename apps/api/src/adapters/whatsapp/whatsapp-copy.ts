import { OwnerLocale } from '@zapbip/types';

export enum OwnerCopyKey {
  UnsupportedKind = 'unsupported_kind',
  MediaUnavailable = 'media_unavailable',
  ListButtonLabel = 'list_button_label',
  ListSectionTitle = 'list_section_title',
  TemplatePreviewFallback = 'template_preview_fallback',
  NumberClosedToNewAccounts = 'number_closed_to_new_accounts',
}

export const WHATSAPP_COPY: Record<OwnerLocale, Record<OwnerCopyKey, string>> = {
  [OwnerLocale.PortugueseBrazil]: {
    [OwnerCopyKey.UnsupportedKind]: 'Este tipo de mensagem ainda não é suportado. Envie como texto ou foto.',
    [OwnerCopyKey.MediaUnavailable]: 'Não consegui baixar o arquivo. Envie de novo, por favor.',
    [OwnerCopyKey.ListButtonLabel]: 'Ver opções',
    [OwnerCopyKey.ListSectionTitle]: 'Opções',
    [OwnerCopyKey.TemplatePreviewFallback]: 'uma mensagem',
    [OwnerCopyKey.NumberClosedToNewAccounts]: 'Este número não está aceitando novas contas no momento.',
  },
  [OwnerLocale.EnglishUs]: {
    [OwnerCopyKey.UnsupportedKind]: 'This kind of message is not supported yet. Send it as text or a photo.',
    [OwnerCopyKey.MediaUnavailable]: 'I could not download the file. Please send it again.',
    [OwnerCopyKey.ListButtonLabel]: 'See options',
    [OwnerCopyKey.ListSectionTitle]: 'Options',
    [OwnerCopyKey.TemplatePreviewFallback]: 'a message',
    [OwnerCopyKey.NumberClosedToNewAccounts]: 'This number is not accepting new accounts right now.',
  },
};
