import type { GraphRequestError } from '../adapters/whatsapp/graph-client';

export enum GraphErrorKind {
  Auth = 'auth',
  NotFound = 'not_found',
  Network = 'network',
  Upstream = 'upstream',
}

export function graphErrorKindOf(_input: { error: GraphRequestError }): GraphErrorKind {
  throw new Error('graphErrorKindOf is not implemented');
}
