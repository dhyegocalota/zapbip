import { HttpStatus } from '@zapbip/types';
import { DeployEnvironment } from './contract/deploy-environment';

const PERMANENT_REDIRECT = 308;
const SAFE_METHODS = ['GET', 'HEAD'];
const PLAIN_PROTOCOL = 'http:';
const SECURE_PROTOCOL = 'https:';

export function httpsRedirectOf(input: { request: Request; environment: DeployEnvironment }): Response | null {
  const { request, environment } = input;
  const url = new URL(request.url);
  const isPlain = url.protocol === PLAIN_PROTOCOL;
  if (!isPlain || environment === DeployEnvironment.Development) return null;
  url.protocol = SECURE_PROTOCOL;
  const status = SAFE_METHODS.includes(request.method) ? HttpStatus.MovedPermanently : PERMANENT_REDIRECT;
  return Response.redirect(url.toString(), status);
}
