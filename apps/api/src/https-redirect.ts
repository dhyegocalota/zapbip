import { HttpStatus } from '@zapbip/types';
import { PERMANENT_REDIRECT_STATUS, SAFE_METHODS } from './backoffice/backoffice-constants';
import { DeployEnvironment } from './contract/deploy-environment';

const PLAIN_PROTOCOL = 'http:';
const SECURE_PROTOCOL = 'https:';

export function httpsRedirectOf(input: { request: Request; environment: DeployEnvironment }): Response | null {
  const { request, environment } = input;
  const url = new URL(request.url);
  const isPlain = url.protocol === PLAIN_PROTOCOL;
  if (!isPlain || environment === DeployEnvironment.Development) return null;
  url.protocol = SECURE_PROTOCOL;
  const status = SAFE_METHODS.includes(request.method) ? HttpStatus.MovedPermanently : PERMANENT_REDIRECT_STATUS;
  return Response.redirect(url.toString(), status);
}
