import { describe, expect, it } from 'vitest';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError, type GraphClient } from '../../src/adapters/whatsapp/graph-client';
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

function graphAnswering(input: { phone: unknown; templates: unknown }): GraphClient {
  return {
    get: async ({ path }) => (path.startsWith(`/${PHONE_NUMBER_ID}`) ? input.phone : input.templates),
    post: () => Promise.reject(new Error('unexpected post')),
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

function verify(input: { graph: GraphClient }) {
  return verifyNumber({ graph: input.graph, phoneNumberId: PHONE_NUMBER_ID, wabaId: WABA_ID, displayNumber: DISPLAY_NUMBER, now: NOW });
}

describe('verifying a number', () => {
  it('keeps only the digits of a display number', () => {
    expect(digitsOf({ value: '+55 11 90000-0001' })).toBe('5511900000001');
  });

  it('verifies a matching display number and lists the four templates', async () => {
    const graph = graphAnswering({
      phone: { display_phone_number: '+55 11 90000-0001', verified_name: 'Logic Bit', quality_rating: 'GREEN' },
      templates: {
        data: [
          { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.PortugueseBrazil, status: 'APPROVED' },
          { name: WhatsAppTemplateName.AgentNotice, language: WhatsAppLanguageCode.EnglishUs, status: 'IN_APPEAL' },
          { name: WhatsAppTemplateName.AgentQuestion, language: WhatsAppLanguageCode.PortugueseBrazil, status: 'PAUSED' },
        ],
      },
    });
    const snapshot = await verify({ graph });
    expect(snapshot.outcome).toBe(VerificationOutcome.Verified);
    expect(snapshot.templates.map((template) => template.status)).toEqual([
      TemplateStatus.Approved,
      TemplateStatus.Pending,
      TemplateStatus.Rejected,
      TemplateStatus.Missing,
    ]);
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
    const graph = graphAnswering({ phone: { display_phone_number: DISPLAY_NUMBER }, templates: { data: [] } });
    const snapshot = await verify({ graph });
    expect(parseVerificationSnapshot({ text: JSON.stringify(snapshot) })).toEqual(snapshot);
  });
});
