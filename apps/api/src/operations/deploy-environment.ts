export enum DeployEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

export function parseDeployEnvironment(input: { value: string | undefined }): DeployEnvironment {
  void input;
  throw new Error('parseDeployEnvironment is not implemented');
}
