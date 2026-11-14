import { describe, expect, it } from 'vitest';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError, type GraphClient } from '../../src/adapters/whatsapp/graph-client';
import {
  WHATSAPP_TEMPLATE_BODIES,
  WHATSAPP_TEMPLATE_QUICK_REPLIES,
  WHATSAPP_TEMPLATE_SAMPLES,
} from '../../src/adapters/whatsapp/whatsapp-templates';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';
import { GraphErrorKind } from '../../src/numbers/graph-error-kind';
import {
  digitsOf,
  parseVerificationSnapshot,
  TemplateStatus,
  VerificationOutcome,
  verifyNumber,
} from '../../src/numbers/number-verification';

const NOW = 1_800_000_000_000;
const PHONE_NUMBER_ID = '1000000000001';
const WABA_ID = '3000000000001';
const DISPLAY_NUMBER = '+5511900000001';

type PostedTemplate = { path: string; body: unknown };

function graphAnswering(input: { phone: unknown; templates: unknown; post?: GraphClient['post'] }): GraphClient {
  return {
    get: async ({ path }) => (path.startsWith(`/${PHONE_NUMBER_ID}`) ? input.phone : input.templates),
    post: input.post === undefined ? () => Promise.reject(new Error('unexpected post')) : input.post,
    download: () => Promise.reject(new Error('unexpected download')),
  };
}

function graphFailing(input: { status: number }): GraphClient {
  return {
    get: () => Promise.reject(new GraphRequestError({ status: input.status, errorCode: null, errorTitle: null, message: 'failed' })),
    post: () => Promise.reject(new Error('unexpected post')),
    download: () => Promise.reject(new Error('unexpected download')),
  };
}

const ALL_TEMPLATE_COUNT = Object.values(WhatsAppTemplateName).length * Object.values(WhatsAppLanguageCode).length;
const MATCHING_PHONE = { display_phone_number: DISPLAY_NUMBER };

function recordingPost(input: { posted: PostedTemplate[]; failOn?: { name: string; language: string } }): GraphClient['post'] {
  return async ({ path, body }) => {
    const { name, language } = body as { name: string; language: string };
    if (input.failOn !== undefined && input.failOn.name === name && input.failOn.language === language) {
      throw new GraphRequestError({ status: 400, errorCode: null, errorTitle: null, message: 'refused' });
    }
    input.posted.push({ path, body });
    return { id: 'created' };
  };
}

function verify(input: { graph: GraphClient }) {
  return verifyNumber({ graph: input.graph, phoneNumberId: PHONE_NUMBER_ID, wabaId: WABA_ID, displayNumber: DISPLAY_NUMBER, now: NOW });
}

describe('verifying a number', () => {
  it('keeps only the digits of a display number', () => {
    expect(digitsOf({ value: '+55 11 90000-0001' })).toBe('5511900000001');
  });

  it('verifies a matching display number and lists every template of every language', async () => {
    const graph = graphAnswering({
      phone: { display_phone_number: '+55 11 90000-0001', verified_name: 'Logic Bit', quality_rating: 'GREEN' },
      templates: {
        data: [
          { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.PortugueseBrazil, status: 'APPROVED' },
          { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.EnglishUs, status: 'IN_APPEAL' },
          { name: WhatsAppTemplateName.AgentQuestion, language: WhatsAppLanguageCode.PortugueseBrazil, status: 'PAUSED' },
        ],
      },
      post: recordingPost({ posted: [] }),
    });
    const snapshot = await verify({ graph });
    expect(snapshot.outcome).toBe(VerificationOutcome.Verified);
    expect(snapshot.templates).toHaveLength(ALL_TEMPLATE_COUNT);
    expect(snapshot.templates.slice(0, 2).map((template) => template.status)).toEqual([TemplateStatus.Approved, TemplateStatus.Pending]);
    expect(snapshot.templates.find((template) => template.name === WhatsAppTemplateName.AgentQuestion)?.status).toBe(
      TemplateStatus.Rejected,
    );
  });

  it('lists eighteen entries, nine languages of each name', async () => {
    const snapshot = await verify({
      graph: graphAnswering({ phone: MATCHING_PHONE, templates: { data: [] }, post: recordingPost({ posted: [] }) }),
    });
    expect(snapshot.templates).toHaveLength(18);
  });

  it('submits every missing template with its exact body, sample and quick reply, and reports it pending', async () => {
    const posted: PostedTemplate[] = [];
    const snapshot = await verify({
      graph: graphAnswering({ phone: MATCHING_PHONE, templates: { data: [] }, post: recordingPost({ posted }) }),
    });
    const name = WhatsAppTemplateName.AgentNotice;
    const language = WhatsAppLanguageCode.EnglishUs;
    expect(posted).toHaveLength(ALL_TEMPLATE_COUNT);
    expect(posted).toContainEqual({
      path: `/${WABA_ID}/message_templates`,
      body: {
        name,
        language,
        category: 'UTILITY',
        components: [
          {
            type: 'BODY',
            text: WHATSAPP_TEMPLATE_BODIES[name][language],
            example: { body_text: [WHATSAPP_TEMPLATE_SAMPLES[name][language]] },
          },
          { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: WHATSAPP_TEMPLATE_QUICK_REPLIES[name][language] }] },
        ],
      },
    });
    expect(snapshot.templates.every((template) => template.status === TemplateStatus.Pending)).toBe(true);
  });

  it('leaves a template missing when its submission fails, and still verifies', async () => {
    const failOn = { name: WhatsAppTemplateName.AgentQuestion, language: WhatsAppLanguageCode.German };
    const snapshot = await verify({
      graph: graphAnswering({ phone: MATCHING_PHONE, templates: { data: [] }, post: recordingPost({ posted: [], failOn }) }),
    });
    const missing = snapshot.templates.filter((template) => template.status === TemplateStatus.Missing);
    expect(snapshot.outcome).toBe(VerificationOutcome.Verified);
    expect(missing).toEqual([{ ...failOn, status: TemplateStatus.Missing }]);
  });

  it('never resubmits a rejected template and never touches an approved one', async () => {
    const posted: PostedTemplate[] = [];
    const snapshot = await verify({
      graph: graphAnswering({
        phone: MATCHING_PHONE,
        templates: {
          data: [
            { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.Arabic, status: 'REJECTED' },
            { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.Korean, status: 'APPROVED' },
          ],
        },
        post: recordingPost({ posted }),
      }),
    });
    const postedLanguages = posted.map((request) => (request.body as { language: string }).language);
    expect(posted).toHaveLength(ALL_TEMPLATE_COUNT - 2);
    expect(postedLanguages.filter((language) => language === WhatsAppLanguageCode.Arabic)).toHaveLength(1);
    expect(snapshot.templates).toContainEqual({
      name: WhatsAppTemplateName.AgentNotice,
      language: WhatsAppLanguageCode.Arabic,
      status: TemplateStatus.Rejected,
    });
    expect(snapshot.templates).toContainEqual({
      name: WhatsAppTemplateName.AgentNotice,
      language: WhatsAppLanguageCode.Korean,
      status: TemplateStatus.Approved,
    });
  });

  it('submits nothing for a number whose display number does not match', async () => {
    const posted: PostedTemplate[] = [];
    await verify({
      graph: graphAnswering({
        phone: { display_phone_number: '+55 11 99999-9999' },
        templates: { data: [] },
        post: recordingPost({ posted }),
      }),
    });
    expect(posted).toEqual([]);
  });

  it('reports a mismatch with both digit strings', async () => {
    const graph = graphAnswering({ phone: { display_phone_number: '+55 11 99999-9999' }, templates: { data: [] } });
    const snapshot = await verify({ graph });
    expect(snapshot).toMatchObject({
      outcome: VerificationOutcome.Mismatch,
      expectedDigits: '5511900000001',
      reportedDigits: '5511999999999',
    });
  });

  it.each([
    { status: 401, kind: GraphErrorKind.Auth },
    { status: 404, kind: GraphErrorKind.NotFound },
    { status: GRAPH_NO_RESPONSE_STATUS, kind: GraphErrorKind.Network },
    { status: 500, kind: GraphErrorKind.Upstream },
  ])('maps a Graph $status to the kind $kind', async ({ status, kind }) => {
    const snapshot = await verify({ graph: graphFailing({ status }) });
    expect(snapshot).toMatchObject({ outcome: VerificationOutcome.Failed, errorKind: kind });
  });

  it('treats a malformed Meta answer as an upstream failure', async () => {
    const snapshot = await verify({ graph: graphAnswering({ phone: { unexpected: true }, templates: {} }) });
    expect(snapshot).toMatchObject({ outcome: VerificationOutcome.Failed, errorKind: GraphErrorKind.Upstream });
  });

  it('round-trips a snapshot through its stored text', async () => {
    const graph = graphAnswering({ phone: MATCHING_PHONE, templates: { data: [] }, post: recordingPost({ posted: [] }) });
    const snapshot = await verify({ graph });
    expect(parseVerificationSnapshot({ text: JSON.stringify(snapshot) })).toEqual(snapshot);
  });
});
