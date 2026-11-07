import { BackofficePath } from '../backoffice-paths';
import type { BackofficeNotice } from '../backoffice-notice';

export enum NumberSegment {
  New = 'new',
  Verify = 'verify',
  Verification = 'verification',
  AccessToken = 'access-token',
  State = 'state',
}

export const META_APPS_PATH = '/meta-apps';
export const APP_SECRET_SEGMENT = 'app-secret';
const NOTICE_QUERY = 'notice';

export function numberPath(input: { numberId: string; segment?: NumberSegment }): string {
  const base = `${BackofficePath.Numbers}/${input.numberId}`;
  return input.segment === undefined ? base : `${base}/${input.segment}`;
}

export function appSecretPath(input: { metaAppRef: string }): string {
  return `${META_APPS_PATH}/${input.metaAppRef}/${APP_SECRET_SEGMENT}`;
}

export function withNotice(input: { path: string; notice: BackofficeNotice }): string {
  return `${input.path}?${NOTICE_QUERY}=${input.notice}`;
}
