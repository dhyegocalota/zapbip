import type { ChannelStatusDetail } from '@zapbip/core';
import { DeliveryState, SECOND_MS } from '@zapbip/types';
import { z } from 'zod';
import { WhatsAppStatusValue } from './whatsapp-enums';

export type ParsedStatus = {
  channelMessageId: string;
  status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed | null;
  detail: ChannelStatusDetail;
  timestamp: number;
};

const DIGITS_PATTERN = /^[0-9]+$/;
const NO_ERROR = { code: null, title: null };

const STATUS_BY_VALUE: Record<WhatsAppStatusValue, ParsedStatus['status']> = {
  [WhatsAppStatusValue.Sent]: DeliveryState.Sent,
  [WhatsAppStatusValue.Delivered]: DeliveryState.Delivered,
  [WhatsAppStatusValue.Read]: DeliveryState.Read,
  [WhatsAppStatusValue.Played]: null,
  [WhatsAppStatusValue.Failed]: DeliveryState.Failed,
};

export const unixSecondsSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(DIGITS_PATTERN).transform(Number)])
  .transform((seconds) => seconds * SECOND_MS);

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(WhatsAppStatusValue),
  timestamp: unixSecondsSchema,
  errors: z
    .array(z.object({ code: z.number().nullable().default(null), title: z.string().nullable().default(null) }))
    .default([])
    .transform(([firstError]) => (firstError === undefined ? NO_ERROR : firstError)),
  pricing: z
    .object({ category: z.string().nullable().default(null), billable: z.boolean().nullable().default(null) })
    .default({ category: null, billable: null }),
});

export function parseStatusItems(input: { rawStatuses: unknown }): ParsedStatus[] {
  return z
    .array(z.unknown())
    .parse(input.rawStatuses)
    .flatMap((rawStatus) => {
      const parsed = statusSchema.safeParse(rawStatus);
      if (!parsed.success) return [];
      const { id, status, timestamp, errors, pricing } = parsed.data;
      const detail = { errorCode: errors.code, errorTitle: errors.title, pricingCategory: pricing.category, billable: pricing.billable };
      return [{ channelMessageId: id, status: STATUS_BY_VALUE[status], detail, timestamp }];
    });
}
