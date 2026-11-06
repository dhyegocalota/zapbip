import type { DeployEnvironment } from '../src/operations/deploy-environment';
import type { SmokeFetch } from '../src/operations/smoke-checks';

export type SmokeEntry = {
  environment: DeployEnvironment;
  firstDeploy: boolean;
  environmentVariables: Record<string, string | undefined>;
  smokeFetch: SmokeFetch;
  wait: (input: { ms: number }) => Promise<void>;
  log: (line: string) => void;
};

export function runSmoke(input: SmokeEntry): Promise<number> {
  void input;
  throw new Error('runSmoke is not implemented');
}
