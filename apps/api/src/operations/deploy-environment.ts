export enum DeployEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

const DEPLOY_ENVIRONMENTS: string[] = Object.values(DeployEnvironment);

function isDeployEnvironment(value: string | undefined): value is DeployEnvironment {
  return value !== undefined && DEPLOY_ENVIRONMENTS.includes(value);
}

export function parseDeployEnvironment(input: { value: string | undefined }): DeployEnvironment {
  if (!isDeployEnvironment(input.value)) throw new Error('ENVIRONMENT is not a deploy environment');
  return input.value;
}
