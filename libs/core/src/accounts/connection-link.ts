import { CONNECTION_LINK_PATH_PREFIX, CONNECTION_LINK_PATH_SUFFIX } from './constants';

export function buildConnectionLink(input: { publicOrigin: string; secret: string }): string {
  return `${input.publicOrigin}${CONNECTION_LINK_PATH_PREFIX}${input.secret}${CONNECTION_LINK_PATH_SUFFIX}`;
}
