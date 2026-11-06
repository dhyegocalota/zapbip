import { DeployEnvironment } from './deploy-environment';
import { SmokeInput } from './smoke-inputs';

const HTTPS_PROTOCOL = 'https:';

function parseUrlOrNull(input: { text: string }): URL | null {
  try {
    return new URL(input.text);
  } catch {
    return null;
  }
}

export function assertSmokeTarget(input: { environment: DeployEnvironment; baseUrl: string; publicOrigin: string }): void {
  const { environment, baseUrl, publicOrigin } = input;
  if (environment === DeployEnvironment.Development) return;
  const target = parseUrlOrNull({ text: baseUrl });
  if (target === null) throw new Error(`${SmokeInput.BaseUrl} is not a url`);
  if (target.protocol !== HTTPS_PROTOCOL) throw new Error(`${SmokeInput.BaseUrl} must use https`);
  const expectedHost = new URL(publicOrigin).host;
  if (target.host !== expectedHost)
    throw new Error(`${SmokeInput.BaseUrl} must point at ${expectedHost}, the host of this environment, not ${target.host}`);
}
