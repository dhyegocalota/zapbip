import { START_PREFILLED_TEXT, WHATSAPP_LINK_ORIGIN, WHATSAPP_LINK_TEXT_PARAMETER, type OwnerLocale } from '@zapbip/types';

const DISPLAY_NUMBER_PATTERN = /^\+\d{7,15}$/;
const DISPLAY_NUMBER_PREFIX_LENGTH = 1;

export function startLinkTarget(input: { displayNumber: string; locale: OwnerLocale }): string | null {
  if (!DISPLAY_NUMBER_PATTERN.test(input.displayNumber)) return null;
  const digits = input.displayNumber.slice(DISPLAY_NUMBER_PREFIX_LENGTH);
  const text = encodeURIComponent(START_PREFILLED_TEXT[input.locale]);
  return `${WHATSAPP_LINK_ORIGIN}/${digits}?${WHATSAPP_LINK_TEXT_PARAMETER}=${text}`;
}
