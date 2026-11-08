import { describe, expect, it } from 'vitest';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError } from '../../src/adapters/whatsapp/graph-client';
import { GraphErrorKind, graphErrorKindOf } from '../../src/numbers/graph-error-kind';

function errorWith(input: { status: number }): GraphRequestError {
  return new GraphRequestError({ status: input.status, errorCode: null, errorTitle: null, message: 'graph failed' });
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
