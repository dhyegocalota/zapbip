import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LOOPBACK_HOST } from './constants';

const runCommand = promisify(execFile);
const DOCKER_DESKTOP_PLATFORM = 'darwin';
const BRIDGE_GATEWAY_TEMPLATE = '{{(index .IPAM.Config 0).Gateway}}';

export async function containerReachableHost(): Promise<string> {
  if (process.platform === DOCKER_DESKTOP_PLATFORM) return LOOPBACK_HOST;
  const { stdout } = await runCommand('docker', ['network', 'inspect', 'bridge', '-f', BRIDGE_GATEWAY_TEMPLATE]);
  return stdout.trim();
}
