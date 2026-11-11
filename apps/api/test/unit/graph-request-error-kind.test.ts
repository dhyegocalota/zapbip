import { describe, expect, it } from 'vitest';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError } from '../../src/adapters/whatsapp/graph-client';
import { GraphErrorKind, graphErrorKindOf } from '../../src/numbers/graph-error-kind';

function errorWith(input: { status: number; errorCode?: number | null }): GraphRequestError {
  const { errorCode = null } = input;
  return new GraphRequestError({ status: input.status, errorCode, errorTitle: null, message: 'graph failed' });
}

describe('the kind of a Graph request error', () => {
  it.each([
    { status: 401, kind: GraphErrorKind.Auth },
    { status: 403, kind: GraphErrorKind.Auth },
    { status: 404, kind: GraphErrorKind.NotFound },
    { status: GRAPH_NO_RESPONSE_STATUS, kind: GraphErrorKind.Network },
    { status: 400, kind: GraphErrorKind.Upstream },
    { status: 429, kind: GraphErrorKind.Upstream },
    { status: 500, kind: GraphErrorKind.Upstream },
    { status: 502, kind: GraphErrorKind.Upstream },
  ])('maps status $status to $kind', ({ status, kind }) => {
    expect(graphErrorKindOf({ error: errorWith({ status }) })).toBe(kind);
  });
});

describe('the kind of a Graph request error by its error code', () => {
  it.each([
    { errorCode: 133005, kind: GraphErrorKind.PinMismatch },
    { errorCode: 133016, kind: GraphErrorKind.RateLimited },
    { errorCode: 4, kind: GraphErrorKind.RateLimited },
    { errorCode: 80007, kind: GraphErrorKind.RateLimited },
    { errorCode: 130429, kind: GraphErrorKind.RateLimited },
  ])('maps code $errorCode on a 400 to $kind', ({ errorCode, kind }) => {
    expect(graphErrorKindOf({ error: errorWith({ status: 400, errorCode }) })).toBe(kind);
  });

  it('lets an error code win over the status', () => {
    expect(graphErrorKindOf({ error: errorWith({ status: 500, errorCode: 133005 }) })).toBe(GraphErrorKind.PinMismatch);
  });

  it.each([100, 190, 1])('keeps code %s on its status kind outside the exchange', (errorCode) => {
    expect(graphErrorKindOf({ error: errorWith({ status: 401, errorCode }) })).toBe(GraphErrorKind.Auth);
  });
});
