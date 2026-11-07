import { execFile } from 'node:child_process';
import { isIPv4 } from 'node:net';
import { promisify } from 'node:util';
import { LOOPBACK_HOST } from './constants';

const runCommand = promisify(execFile);
const DOCKER_DESKTOP_PLATFORM = 'darwin';
const BRIDGE_GATEWAY_TEMPLATE = '{{(index .IPAM.Config 0).Gateway}}';

export function bridgeGatewayHostOf(input: { output: string }): string {
  const host = input.output.trim();
  if (!isIPv4(host)) throw new Error(`the docker bridge gateway is not an IPv4 address: "${host}"`);
  return host;
}

export async function containerReachableHost(): Promise<string> {
  if (process.platform === DOCKER_DESKTOP_PLATFORM) return LOOPBACK_HOST;
  const { stdout } = await runCommand('docker', ['network', 'inspect', 'bridge', '-f', BRIDGE_GATEWAY_TEMPLATE]);
  return bridgeGatewayHostOf({ output: stdout });
}
