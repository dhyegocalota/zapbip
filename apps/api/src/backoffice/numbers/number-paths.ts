import { BackofficePath } from '../backoffice-paths';
import type { BackofficeNotice } from '../backoffice-notice';

export enum NumberSegment {
  Connect = 'connect',
  Meta = 'meta',
  Verify = 'verify',
  Verification = 'verification',
  AccessToken = 'access-token',
  State = 'state',
}

const NOTICE_QUERY = 'notice';

export function numberPath(input: { numberId: string; segment?: NumberSegment }): string {
  const base = `${BackofficePath.Numbers}/${input.numberId}`;
  return input.segment === undefined ? base : `${base}/${input.segment}`;
}

export function withNotice(input: { path: string; notice: BackofficeNotice }): string {
  return `${input.path}?${NOTICE_QUERY}=${input.notice}`;
}
