import {
  DISPLAY_NUMBER_PATTERN,
  START_PREFILLED_TEXT,
  WHATSAPP_LINK_ORIGIN,
  WHATSAPP_LINK_TEXT_PARAMETER,
  type OwnerLocale,
} from '@zapbip/types';

const DISPLAY_NUMBER_PREFIX_LENGTH = 1;

export function whatsappLinkTarget(input: { displayNumber: string; text: string }): string | null {
  if (!DISPLAY_NUMBER_PATTERN.test(input.displayNumber)) return null;
  const digits = input.displayNumber.slice(DISPLAY_NUMBER_PREFIX_LENGTH);
  return `${WHATSAPP_LINK_ORIGIN}/${digits}?${WHATSAPP_LINK_TEXT_PARAMETER}=${encodeURIComponent(input.text)}`;
}

export function startLinkTarget(input: { displayNumber: string; locale: OwnerLocale }): string | null {
  return whatsappLinkTarget({ displayNumber: input.displayNumber, text: START_PREFILLED_TEXT[input.locale] });
}
