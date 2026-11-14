import { z } from 'zod';
import { GraphRequestError, type GraphClient } from '../adapters/whatsapp/graph-client';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../adapters/whatsapp/whatsapp-enums';
import {
  WHATSAPP_TEMPLATE_BODIES,
  WHATSAPP_TEMPLATE_QUICK_REPLIES,
  WHATSAPP_TEMPLATE_SAMPLES,
} from '../adapters/whatsapp/whatsapp-templates';
import { GraphErrorKind, graphErrorKindOf } from './graph-error-kind';

export enum VerificationOutcome {
  Verified = 'verified',
  Mismatch = 'mismatch',
  Failed = 'failed',
}

export enum TemplateStatus {
  Approved = 'approved',
  Pending = 'pending',
  Rejected = 'rejected',
  Missing = 'missing',
}

export type TemplateEntry = { name: WhatsAppTemplateName; language: WhatsAppLanguageCode; status: TemplateStatus };

export type VerificationSnapshot = {
  outcome: VerificationOutcome;
  errorKind: GraphErrorKind | null;
  expectedDigits: string;
  reportedDigits: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  templates: TemplateEntry[];
  checkedAt: number;
};

const TEMPLATE_LIMIT = 100;
const NON_DIGITS_PATTERN = /\D/g;
const APPROVED_STATUS = 'APPROVED';
const PENDING_STATUSES = ['PENDING', 'IN_APPEAL'];
const CHECKED_TEMPLATE_NAMES = Object.values(WhatsAppTemplateName);
const CHECKED_LANGUAGES = Object.values(WhatsAppLanguageCode);

enum TemplateSubmission {
  Category = 'UTILITY',
  BodyComponent = 'BODY',
  ButtonsComponent = 'BUTTONS',
  QuickReplyButton = 'QUICK_REPLY',
}

const phoneResponseSchema = z.object({
  display_phone_number: z.string(),
  verified_name: z.string().nullable().default(null),
  quality_rating: z.string().nullable().default(null),
});
const templatesResponseSchema = z.object({
  data: z.array(z.object({ name: z.string(), language: z.string(), status: z.string() })),
});
const snapshotSchema = z.object({
  outcome: z.enum(VerificationOutcome),
  errorKind: z.enum(GraphErrorKind).nullable(),
  expectedDigits: z.string(),
  reportedDigits: z.string().nullable(),
  verifiedName: z.string().nullable(),
  qualityRating: z.string().nullable(),
  templates: z.array(
    z.object({ name: z.enum(WhatsAppTemplateName), language: z.enum(WhatsAppLanguageCode), status: z.enum(TemplateStatus) }),
  ),
  checkedAt: z.number(),
});

export function digitsOf(input: { value: string }): string {
  return input.value.replace(NON_DIGITS_PATTERN, '');
}

function templateStatusOf(input: { status: string | undefined }): TemplateStatus {
  const { status } = input;
  if (status === undefined) return TemplateStatus.Missing;
  if (status === APPROVED_STATUS) return TemplateStatus.Approved;
  return PENDING_STATUSES.includes(status) ? TemplateStatus.Pending : TemplateStatus.Rejected;
}

function templateEntriesOf(input: { listed: z.infer<typeof templatesResponseSchema>['data'] }): TemplateEntry[] {
  return CHECKED_TEMPLATE_NAMES.flatMap((name) =>
    CHECKED_LANGUAGES.map((language) => {
      const found = input.listed.find((template) => template.name === name && template.language === language);
      return { name, language, status: templateStatusOf({ status: found === undefined ? undefined : found.status }) };
    }),
  );
}

function templateSubmissionOf(input: { entry: TemplateEntry }): unknown {
  const { name, language } = input.entry;
  return {
    name,
    language,
    category: TemplateSubmission.Category,
    components: [
      {
        type: TemplateSubmission.BodyComponent,
        text: WHATSAPP_TEMPLATE_BODIES[name][language],
        example: { body_text: [WHATSAPP_TEMPLATE_SAMPLES[name][language]] },
      },
      {
        type: TemplateSubmission.ButtonsComponent,
        buttons: [{ type: TemplateSubmission.QuickReplyButton, text: WHATSAPP_TEMPLATE_QUICK_REPLIES[name][language] }],
      },
    ],
  };
}

async function submitMissingTemplates(input: { graph: GraphClient; wabaId: string; entries: TemplateEntry[] }): Promise<TemplateEntry[]> {
  return Promise.all(
    input.entries.map(async (entry) => {
      if (entry.status !== TemplateStatus.Missing) return entry;
      try {
        await input.graph.post({ path: `/${input.wabaId}/message_templates`, body: templateSubmissionOf({ entry }) });
        return { ...entry, status: TemplateStatus.Pending };
      } catch (error) {
        if (error instanceof GraphRequestError) return entry;
        throw error;
      }
    }),
  );
}

function failedSnapshot(input: { expectedDigits: string; errorKind: GraphErrorKind; checkedAt: number }): VerificationSnapshot {
  return {
    outcome: VerificationOutcome.Failed,
    errorKind: input.errorKind,
    expectedDigits: input.expectedDigits,
    reportedDigits: null,
    verifiedName: null,
    qualityRating: null,
    templates: [],
    checkedAt: input.checkedAt,
  };
}

function errorKindOf(input: { error: unknown }): GraphErrorKind {
  if (input.error instanceof GraphRequestError) return graphErrorKindOf({ error: input.error });
  if (input.error instanceof z.ZodError) return GraphErrorKind.Upstream;
  throw input.error;
}

export async function verifyNumber(input: {
  graph: GraphClient;
  phoneNumberId: string;
  wabaId: string;
  displayNumber: string;
  now: number;
}): Promise<VerificationSnapshot> {
  const { graph, phoneNumberId, wabaId, now } = input;
  const expectedDigits = digitsOf({ value: input.displayNumber });
  try {
    const phone = phoneResponseSchema.parse(
      await graph.get({ path: `/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating` }),
    );
    const templates = templatesResponseSchema.parse(
      await graph.get({ path: `/${wabaId}/message_templates?fields=name,language,status&limit=${TEMPLATE_LIMIT}` }),
    );
    const reportedDigits = digitsOf({ value: phone.display_phone_number });
    const outcome = reportedDigits === expectedDigits ? VerificationOutcome.Verified : VerificationOutcome.Mismatch;
    const listedEntries = templateEntriesOf({ listed: templates.data });
    return {
      outcome,
      errorKind: null,
      expectedDigits,
      reportedDigits,
      verifiedName: phone.verified_name,
      qualityRating: phone.quality_rating,
      templates:
        outcome === VerificationOutcome.Verified ? await submitMissingTemplates({ graph, wabaId, entries: listedEntries }) : listedEntries,
      checkedAt: now,
    };
  } catch (error) {
    return failedSnapshot({ expectedDigits, errorKind: errorKindOf({ error }), checkedAt: now });
  }
}

export function parseVerificationSnapshot(input: { text: string }): VerificationSnapshot {
  return snapshotSchema.parse(JSON.parse(input.text));
}
