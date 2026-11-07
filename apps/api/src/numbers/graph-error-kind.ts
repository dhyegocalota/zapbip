import { HttpStatus } from '@zapbip/types';
import { GRAPH_NO_RESPONSE_STATUS, type GraphRequestError } from '../adapters/whatsapp/graph-client';

export enum GraphErrorKind {
  Auth = 'auth',
  NotFound = 'not_found',
  Network = 'network',
  Upstream = 'upstream',
}

const KIND_BY_STATUS: Record<number, GraphErrorKind> = {
  [HttpStatus.Unauthorized]: GraphErrorKind.Auth,
  [HttpStatus.Forbidden]: GraphErrorKind.Auth,
  [HttpStatus.NotFound]: GraphErrorKind.NotFound,
  [GRAPH_NO_RESPONSE_STATUS]: GraphErrorKind.Network,
};

export function graphErrorKindOf(input: { error: GraphRequestError }): GraphErrorKind {
  const kind = KIND_BY_STATUS[input.error.status];
  return kind === undefined ? GraphErrorKind.Upstream : kind;
}
