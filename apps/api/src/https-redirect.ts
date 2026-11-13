import type { DeployEnvironment } from './contract/deploy-environment';

export function httpsRedirectOf(input: { request: Request; environment: DeployEnvironment }): Response | null {
  throw new Error('httpsRedirectOf is not implemented');
}
