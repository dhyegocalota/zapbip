import { ChannelError } from '@zapbip/core';
import { ChannelErrorKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { mapGraphErrorToChannelError } from '../../src/adapters/whatsapp/channel-error-mapping';
import { GRAPH_NO_RESPONSE_STATUS } from '../../src/adapters/whatsapp/graph-client';

const SUBJECT = 'text';

function map(input: { status?: number; errorCode: number | null; isTemplateSend?: boolean; message?: string }): ChannelError {
  return mapGraphErrorToChannelError({
    status: input.status === undefined ? 400 : input.status,
    errorCode: input.errorCode,
    errorTitle: null,
    message: input.message === undefined ? SUBJECT : input.message,
    isTemplateSend: input.isTemplateSend === undefined ? false : input.isTemplateSend,
  });
}

const SESSION_ROWS: [number, ChannelErrorKind][] = [
  [131047, ChannelErrorKind.WindowClosed],
  [130429, ChannelErrorKind.RateLimited],
  [80007, ChannelErrorKind.RateLimited],
  [4, ChannelErrorKind.RateLimited],
  [131056, ChannelErrorKind.RateLimited],
  [131048, ChannelErrorKind.Restricted],
  [368, ChannelErrorKind.Restricted],
  [133010, ChannelErrorKind.Restricted],
  [131026, ChannelErrorKind.DeliveryFailed],
  [131021, ChannelErrorKind.DeliveryFailed],
  [131009, ChannelErrorKind.ReactionRejected],
  [131053, ChannelErrorKind.MediaRejected],
  [131051, ChannelErrorKind.MediaRejected],
  [190, ChannelErrorKind.Auth],
  [999_999, ChannelErrorKind.Unknown],
];

describe('mapGraphErrorToChannelError', () => {
  it.each(SESSION_ROWS)('AU-97 maps code %i on a session send to %s', (errorCode, kind) => {
    const error = map({ errorCode });
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.code).toBe(kind);
    expect(error.errorCode).toBe(errorCode);
  });

  it('AU-98 tells the agent the channel is busy', () => {
    expect(map({ errorCode: 130_429 }).message).toContain('busy');
  });

  it('AU-124 names the kind the delivery failed for', () => {
    expect(map({ errorCode: 131_026, message: 'image' }).message).toContain('image');
  });

  it('AU-101 names reaction.message_id for a rejected reaction', () => {
    expect(map({ errorCode: 131_009, message: 'reaction.message_id' }).message).toContain('reaction.message_id');
  });

  it('AU-102 names the kind and the MIME type of a rejected media', () => {
    expect(map({ errorCode: 131_053, message: 'image image/jpeg' }).message).toMatch(/image.*image\/jpeg/);
  });

  it('AU-105 maps status 401 without a code to auth', () => {
    expect(map({ status: 401, errorCode: null }).code).toBe(ChannelErrorKind.Auth);
  });

  it('AU-105 maps code 190 with status 401 to auth', () => {
    expect(map({ status: 401, errorCode: 190 }).code).toBe(ChannelErrorKind.Auth);
  });

  it('AU-106 maps a server error without a code to timeout', () => {
    expect(map({ status: 500, errorCode: null }).code).toBe(ChannelErrorKind.Timeout);
  });

  it('AU-106 maps a request that got no response to timeout', () => {
    expect(map({ status: GRAPH_NO_RESPONSE_STATUS, errorCode: null }).code).toBe(ChannelErrorKind.Timeout);
  });

  it('AU-107 maps an unknown code on a session send to unknown', () => {
    expect(map({ errorCode: 999_999 }).code).toBe(ChannelErrorKind.Unknown);
  });

  it('AU-108 maps an unknown code on a template send to template rejected', () => {
    expect(map({ errorCode: 132_000, isTemplateSend: true }).code).toBe(ChannelErrorKind.TemplateRejected);
  });

  it('maps a template send with no code and a client status to template rejected', () => {
    expect(map({ errorCode: null, isTemplateSend: true }).code).toBe(ChannelErrorKind.TemplateRejected);
  });

  it('AU-109 keeps the table row over the template default', () => {
    expect(map({ errorCode: 131_048, isTemplateSend: true }).code).toBe(ChannelErrorKind.Restricted);
  });
});
