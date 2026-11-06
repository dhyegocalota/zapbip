import { normalizeText } from '@zapbip/core';
import { TEMPLATE_PREVIEW_MAX_CHARS } from './whatsapp-constants';

const HIGH_SURROGATE_FIRST = 0xd800;
const HIGH_SURROGATE_LAST = 0xdbff;
const PARAMETER_AT_EDGE_PATTERN = /^\s*\{\{\d+\}\}|\{\{\d+\}\}\s*$/;

export function sanitiseTemplateParameter(input: { value: string; fallback: string }): string {
  const cut = normalizeText({ value: input.value }).slice(0, TEMPLATE_PREVIEW_MAX_CHARS);
  const lastCode = cut.charCodeAt(cut.length - 1);
  const endsInHighSurrogate = lastCode >= HIGH_SURROGATE_FIRST && lastCode <= HIGH_SURROGATE_LAST;
  const sanitised = (endsInHighSurrogate ? cut.slice(0, -1) : cut).trimEnd();
  if (sanitised.length === 0) return input.fallback;
  return sanitised;
}

export function assertTemplateBodyHasFixedWords(input: { body: string }): void {
  if (!PARAMETER_AT_EDGE_PATTERN.test(input.body)) return;
  throw new Error(`template body must not start or end with a parameter: ${input.body}`);
}
