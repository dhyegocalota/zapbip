import { describe, expect, it } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import { SMOKE_POLL_ATTEMPTS, SMOKE_POLL_INTERVAL_MS } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { formatSmokeResult, runSmokeChecks } from '../../src/operations/smoke-checks';
import { SIGNATURE_HEADER, signWebhookBody } from '../../src/operations/signed-webhook';
import { SmokeCheck, SmokeInput, type SmokeInputs } from '../../src/operations/smoke-inputs';
import {
  APP_SECRET,
  PLACEHOLDER_APP_SECRET,
  CONNECTION_SECRET,
  type Behavior,
  fakeStack,
  INPUTS,
  MCP_PATH,
  OWNER_PHONE,
  type Recorded,
  tokenSource,
  TOOL_NAMES,
  VERIFY_TOKEN,
  WEBHOOK_PATH,
  ZERO_SIGNATURE,
} from './fake-smoke-stack';

async function run(input: {
  behavior?: Behavior;
  environment?: DeployEnvironment;
  firstDeploy?: boolean;
  tokenPrefix?: string;
  inputs?: SmokeInputs;
}) {
  const { behavior = {}, environment = DeployEnvironment.Staging, firstDeploy = false, tokenPrefix, inputs = INPUTS } = input;
  const stack = fakeStack(behavior);
  const waits: number[] = [];
  const results = await runSmokeChecks({
    environment,
    firstDeploy,
    inputs,
    smokeFetch: stack.smokeFetch,
    wait: async ({ ms }) => {
      waits.push(ms);
    },
    randomToken: tokenSource(tokenPrefix),
    nowSeconds: () => 1_762_387_200,
  });
  return { results, waits, requests: stack.requests, lines: results.map((result) => formatSmokeResult({ result })) };
}

describe('smoke checks', () => {
  it('passes all five checks against a healthy stack', async () => {
    const { lines } = await run({});
    expect(lines).toEqual([
      'PASS 200 health',
      'PASS 200 mcp initialize',
      'PASS 200 webhook verify',
      'PASS 401 signature rejected',
      'PASS 200 fake inbound',
    ]);
  });

  it('formats every line as status then name', async () => {
    const { lines } = await run({});
    expect(lines.every((line) => /^(PASS|FAIL) \d{3} .+$/.test(line))).toBe(true);
  });

  it('check 1 fails on the wrong environment', async () => {
    const { lines } = await run({ behavior: { healthEnvironment: DeployEnvironment.Production } });
    expect(lines[0]).toMatch(/^FAIL 200 health/);
  });

  it('check 1 fails on a wrong status', async () => {
    const { lines } = await run({ behavior: { healthStatus: 500 } });
    expect(lines[0]).toMatch(/^FAIL 500 health/);
  });

  it('check 2 fails and names the missing tool', async () => {
    const [missing, ...rest] = TOOL_NAMES;
    const { lines } = await run({ behavior: { toolNames: rest } });
    expect(lines[1]).toMatch(/^FAIL 200 mcp initialize/);
    expect(lines[1]).toContain(missing);
  });

  it('check 2 sends initialize then tools/list on the secret path', async () => {
    const { requests } = await run({});
    const mcp = requests
      .filter((request) => request.pathname === MCP_PATH)
      .map((request) => (JSON.parse(request.body) as { method: string }).method);
    expect(mcp.slice(0, 2)).toEqual(['initialize', 'tools/list']);
  });

  it('check 3 sends the verify token with a challenge that differs between runs', async () => {
    const first = await run({ tokenPrefix: 'first' });
    const second = await run({ tokenPrefix: 'second' });
    const challengeOf = (requests: Recorded[]) =>
      requests
        .find((request) => request.pathname === WEBHOOK_PATH && request.search.get('hub.verify_token') === VERIFY_TOKEN)
        ?.search.get('hub.challenge');
    expect(challengeOf(first.requests)).toBeTruthy();
    expect(challengeOf(first.requests)).not.toBe(challengeOf(second.requests));
  });

  it('check 3 passes when the wrong token is refused', async () => {
    const { lines } = await run({});
    expect(lines[2]).toBe('PASS 200 webhook verify');
  });

  it('check 3 fails when the wrong token is accepted', async () => {
    const { lines } = await run({ behavior: { verifyStatusForWrongToken: 200 } });
    expect(lines[2]).toMatch(/^FAIL 200 webhook verify/);
  });

  it('check 4 sends a zero signature and fails when it is accepted', async () => {
    const accepted = await run({ behavior: { badSignatureStatus: 200 } });
    expect(accepted.lines[3]).toMatch(/^FAIL 200 signature rejected/);
    expect(accepted.requests.some((request) => request.headers.get(SIGNATURE_HEADER) === ZERO_SIGNATURE)).toBe(true);
  });

  it('check 4 also sends a body signed with the placeholder app secret and fails when it is accepted', async () => {
    const accepted = await run({ behavior: { placeholderSignatureStatus: 200 } });
    expect(accepted.lines[3]).toMatch(/^FAIL 200 signature rejected/);
    expect(accepted.lines[3]).toContain('placeholder');
    const sentWithPlaceholder = accepted.requests.filter(
      (request) => request.headers.get(SIGNATURE_HEADER) === signWebhookBody({ appSecret: PLACEHOLDER_APP_SECRET, body: request.body }),
    );
    expect(sentWithPlaceholder).toHaveLength(1);
  });

  it('check 4 passes when the placeholder-signed body is refused too', async () => {
    const refused = await run({ behavior: { placeholderSignatureStatus: 403 } });
    expect(refused.lines[3]).toBe('PASS 401 signature rejected');
  });

  it('stops the run when health fails, sending nothing to the connection path', async () => {
    const { lines, requests } = await run({ behavior: { healthStatus: 500 } });
    expect(lines).toEqual(['FAIL 500 health (expected status 200)']);
    expect(requests.some((request) => request.pathname === MCP_PATH)).toBe(false);
  });

  it('check 5 signs the exact body it posts with the app secret', async () => {
    const { requests } = await run({});
    const post = requests.find((request) => request.body.includes('@smoke token'));
    expect(post?.headers.get(SIGNATURE_HEADER)).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(post?.body).toContain(OWNER_PHONE);
    expect(post?.body).toContain('PNID');
  });

  it('check 5 polls check_inbox spaced by the poll interval until the message arrives', async () => {
    const { lines, waits, requests } = await run({ behavior: { inboxAppearsAtPoll: 3 } });
    expect(lines[4]).toBe('PASS 200 fake inbound');
    const polls = requests.filter((request) => request.body.includes(McpToolName.CheckInbox));
    expect(polls).toHaveLength(3);
    expect(waits).toEqual([SMOKE_POLL_INTERVAL_MS, SMOKE_POLL_INTERVAL_MS]);
  });

  it('check 5 fails with the attempt count when the message never arrives', async () => {
    const { lines } = await run({ behavior: { inboxAppearsAtPoll: SMOKE_POLL_ATTEMPTS + 1 } });
    expect(lines[4]).toMatch(/^FAIL 200 fake inbound/);
    expect(lines[4]).toContain(String(SMOKE_POLL_ATTEMPTS));
  });

  it('check 5 fails when the message is not from the verified owner', async () => {
    const { lines } = await run({ behavior: { inboxSender: 'agent' } });
    expect(lines[4]).toMatch(/^FAIL 200 fake inbound/);
  });

  it('check 5 fails with the webhook status when the signature is refused', async () => {
    const { lines } = await run({ behavior: { goodSignatureStatus: 401 } });
    expect(lines[4]).toMatch(/^FAIL 401 fake inbound/);
  });

  it('production runs checks 1 to 4 and posts no smoke inbound', async () => {
    const { lines, requests } = await run({
      environment: DeployEnvironment.Production,
      behavior: { healthEnvironment: DeployEnvironment.Production },
    });
    expect(lines).toHaveLength(4);
    expect(lines.join('\n')).not.toContain(SmokeCheck.FakeInbound);
    expect(requests.filter((request) => request.method === 'POST' && request.body.includes('@smoke'))).toEqual([]);
  });

  it('a first deploy skips checks 2 and 5 and sends no request to the connection path', async () => {
    const { lines, requests } = await run({ firstDeploy: true });
    expect(lines).toEqual(['PASS 200 health', 'PASS 200 webhook verify', 'PASS 401 signature rejected']);
    expect(requests.some((request) => request.pathname === MCP_PATH)).toBe(false);
  });

  it('turns a failed request into a failed check without leaking the url', async () => {
    const { lines } = await run({ behavior: { throwOnFetch: true } });
    expect(lines.every((line) => line.startsWith('FAIL 000 '))).toBe(true);
    expect(lines.join('\n')).not.toContain(CONNECTION_SECRET);
  });

  it('names the failure kind of a failed request, not its message', async () => {
    const { lines } = await run({ behavior: { throwOnFetch: true } });
    expect(lines[0]).toBe('FAIL 000 health (request failed: ECONNREFUSED)');
  });

  it('trims a trailing slash from the base url', async () => {
    const inputs = { ...INPUTS, [SmokeInput.BaseUrl]: `${INPUTS[SmokeInput.BaseUrl]}/` };
    const { lines } = await run({ inputs });
    expect(lines[0]).toBe('PASS 200 health');
  });

  it('prints no secret in any line', async () => {
    const { lines } = await run({});
    const printed = lines.join('\n');
    [APP_SECRET, VERIFY_TOKEN, CONNECTION_SECRET].forEach((secret) => expect(printed).not.toContain(secret));
  });

  it('puts the connection secret only in the mcp request path', async () => {
    const { requests } = await run({});
    const carrying = requests.filter((request) => `${request.pathname}${request.search}${request.body}`.includes(CONNECTION_SECRET));
    expect(carrying.every((request) => request.pathname === MCP_PATH)).toBe(true);
  });
});
