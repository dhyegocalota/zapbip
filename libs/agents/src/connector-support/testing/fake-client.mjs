#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

export function runFakeClient(input) {
  const clientName = basename(process.argv[1]);
  const clientArguments = process.argv.slice(2);
  const standardInput = readFileSync(0, 'utf8');
  const isResume = clientArguments.includes('resume');
  const ACTIVE_WRITER_TEXT = 'Error: thread already has an active writer for this session';
  const HOLD_POLL_MS = 10;
  const SIGTERM_EXIT_CODE = 143;

  function record(entry) {
    const line = JSON.stringify({ pid: process.pid, clientName, argv: clientArguments, cwd: process.cwd(), at: Date.now(), ...entry });
    appendFileSync(process.env.FAKE_CLIENT_RECORD, `${line}\n`);
  }

  function finish(exitCode) {
    record({ event: 'ended', exitCode, signal: null });
    process.exit(exitCode);
  }

  async function writeCreatedSession(input) {
    const sessionId = process.env.FAKE_CLIENT_ROLLOUT_SESSION_ID;
    if (!sessionId || isResume) return;
    const homeDirectory = process.env[input.homeVariable];
    const modifiedAtSeconds = Math.floor(Date.now() / 1000);
    await input.writeSession({ homeDirectory, workingDirectory: process.cwd(), sessionId, modifiedAtSeconds });
  }

  function isRefused() {
    const refusedSession = process.env.FAKE_CLIENT_REFUSE_SESSION;
    const refusesThisResume = isResume && refusedSession && clientArguments.includes(refusedSession);
    const refusesEveryResume = isResume && process.env.FAKE_CLIENT_REFUSE_RESUME === '1';
    return process.env.FAKE_CLIENT_REFUSE_ALL === '1' || refusesEveryResume || refusesThisResume;
  }

  const OWNER_TEXT_PATTERN = /^<channel[^>]*>([\s\S]*?)<\/channel>/;
  const MCP_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

  function unescapeChannelText(text) {
    return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  }

  async function postMcp(url, body) {
    const response = await fetch(url, { method: 'POST', headers: MCP_HEADERS, body: JSON.stringify(body) });
    record({ event: 'mcp', method: body.method, status: response.status });
    if (!response.ok) throw new Error(`mcp ${body.method} answered ${response.status}`);
  }

  function mcpConfigPath() {
    const flag = clientArguments.find((argument) => argument.startsWith('--mcp-config='));
    return flag ? flag.slice('--mcp-config='.length) : null;
  }

  function reachableServers() {
    const configPath = mcpConfigPath();
    const configuredZapbip = process.env.FAKE_CLIENT_ZAPBIP_URL ? { zapbip: { url: process.env.FAKE_CLIENT_ZAPBIP_URL } } : {};
    const configured = configPath ? JSON.parse(readFileSync(configPath, 'utf8')).mcpServers : configuredZapbip;
    const allUserServers = Object.entries(JSON.parse(process.env.FAKE_CLIENT_USER_MCP_SERVERS || '{}'));
    const userServers = Object.fromEntries(
      allUserServers.filter(([name]) => !clientArguments.some((argument) => argument.includes(`mcp_servers.${name}.enabled=false`))),
    );
    const strictArgument = process.env.FAKE_CLIENT_STRICT_ARGUMENT;
    const isStrict = Boolean(strictArgument) && clientArguments.includes(strictArgument);
    return isStrict ? configured : { ...userServers, ...configured };
  }

  async function callOtherServers(servers) {
    const others = Object.entries(servers).filter(([name]) => name !== 'zapbip');
    await Promise.all(
      others.map(([name, server]) =>
        postMcp(server.url, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'deploy', arguments: {} } }),
      ),
    );
  }

  async function replyThroughMcp() {
    const servers = reachableServers();
    await callOtherServers(servers);
    const { url } = servers.zapbip;
    const ownerText = unescapeChannelText(OWNER_TEXT_PATTERN.exec(standardInput)[1]);
    await postMcp(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fake', version: '0' } },
    });
    await postMcp(url, { jsonrpc: '2.0', method: 'notifications/initialized' });
    await postMcp(url, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'send_message', arguments: { text: `FAKE-REPLY ${ownerText}`, reply_to: null } },
    });
  }

  function complete() {
    writeCreatedSession(input).then(() => finish(Number(process.env.FAKE_CLIENT_EXIT_CODE || 0)));
  }

  function waitForRelease(releaseFile) {
    if (existsSync(releaseFile)) return complete();
    setTimeout(() => waitForRelease(releaseFile), HOLD_POLL_MS);
  }

  function main() {
    const configPath = mcpConfigPath();
    const mcpConfig = configPath ? { text: readFileSync(configPath, 'utf8'), mode: statSync(configPath).mode & 0o777 } : null;
    const probe = process.env.FAKE_CLIENT_PROBE;
    record({
      event: 'started',
      stdin: standardInput,
      hadConnectionUrl: 'ZAPBIP_CONNECTION_URL' in process.env,
      mcpConfig,
      probe: probe === undefined ? null : probe,
    });
    process.on('SIGTERM', () => {
      if (process.env.FAKE_CLIENT_IGNORE_SIGTERM === '1') return record({ event: 'sigterm_ignored' });
      record({ event: 'ended', exitCode: null, signal: 'SIGTERM' });
      process.exit(SIGTERM_EXIT_CODE);
    });
    if (process.env.FAKE_CLIENT_OUTPUT) {
      process.stdout.write(process.env.FAKE_CLIENT_OUTPUT);
      process.stderr.write(process.env.FAKE_CLIENT_OUTPUT);
    }
    if (isRefused()) {
      process.stderr.write(ACTIVE_WRITER_TEXT);
      return finish(1);
    }
    if (process.env.FAKE_CLIENT_CALLS_MCP === '1')
      return replyThroughMcp().then(
        () => setTimeout(complete, Number(process.env.FAKE_CLIENT_RUN_MS || 0)),
        (error) => {
          process.stderr.write(String(error));
          finish(1);
        },
      );
    if (process.env.FAKE_CLIENT_HANG === '1') return setInterval(() => {}, 1 << 30);
    if (process.env.FAKE_CLIENT_HOLD_FILE) return waitForRelease(process.env.FAKE_CLIENT_HOLD_FILE);
    setTimeout(complete, Number(process.env.FAKE_CLIENT_RUN_MS || 0));
  }

  main();
}
