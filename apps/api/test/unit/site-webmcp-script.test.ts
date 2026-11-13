import { describe, expect, it } from 'vitest';
import { WEBMCP_SOURCE, WebMcpTool } from '../../src/site/site-webmcp-script';
import { SITE_SCRIPT } from '../../src/site/site-scripts';

type RegisteredTool = { name: string; description: string; inputSchema: { type: string }; execute: (input: object) => Promise<ToolResult> };
type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };
type FetchCall = { path: string; init: RequestInit | undefined };
type LanguageOption = { lang: string; form: { requestSubmit: (submitter: LanguageOption) => void } };

const PAGE_LANGUAGE = 'en';
const TOOL_NAMES = Object.values(WebMcpTool);

function pageOf(input: { options?: LanguageOption[] }): object {
  return {
    documentElement: { lang: PAGE_LANGUAGE },
    querySelectorAll: () => (input.options === undefined ? [] : input.options),
  };
}

function fetchRecording(input: { status: number; payload: object }): { fetchImplementation: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImplementation = (async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return Response.json(input.payload, { status: input.status });
  }) as unknown as typeof fetch;
  return { fetchImplementation, calls };
}

function tools(input: { page?: object; navigatorObject?: object; fetchImplementation?: typeof fetch }): RegisteredTool[] {
  const registered: RegisteredTool[] = [];
  const modelContext = { registerTool: (tool: RegisteredTool) => registered.push(tool) };
  const page = input.page === undefined ? pageOf({}) : input.page;
  const run = new Function('document', 'navigator', 'fetch', `${WEBMCP_SOURCE}\nsetupModelContext();`);
  run({ ...page, modelContext }, input.navigatorObject === undefined ? {} : input.navigatorObject, input.fetchImplementation);
  return registered;
}

describe('the WebMCP part of the site script', () => {
  it('is part of the served script', () => {
    expect(SITE_SCRIPT).toContain('setupModelContext();');
    TOOL_NAMES.forEach((name) => expect(SITE_SCRIPT).toContain(`name: '${name}'`));
  });

  it('registers the four tools on document.modelContext, each with a description and an object schema', () => {
    const registered = tools({});
    expect(registered.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    registered.forEach((tool) => {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  it('falls back to navigator.modelContext when the document has none', () => {
    const registered: RegisteredTool[] = [];
    const navigatorObject = { modelContext: { registerTool: (tool: RegisteredTool) => registered.push(tool) } };
    new Function('document', 'navigator', 'fetch', `${WEBMCP_SOURCE}\nsetupModelContext();`)(pageOf({}), navigatorObject, undefined);
    expect(registered).toHaveLength(TOOL_NAMES.length);
  });

  it('does nothing and throws nothing without WebMCP', () => {
    const run = new Function('document', 'navigator', 'fetch', `${WEBMCP_SOURCE}\nsetupModelContext();`);
    expect(() => run(pageOf({}), {}, undefined)).not.toThrow();
  });

  it('survives a registration that throws or rejects', async () => {
    const run = new Function('document', 'navigator', 'fetch', `${WEBMCP_SOURCE}\nsetupModelContext();`);
    const throwing = {
      registerTool: () => {
        throw new Error('not allowed');
      },
    };
    const rejecting = { registerTool: () => Promise.reject(new Error('not allowed')) };
    expect(() => run({ ...pageOf({}), modelContext: throwing }, {}, undefined)).not.toThrow();
    expect(() => run({ ...pageOf({}), modelContext: rejecting }, {}, undefined)).not.toThrow();
  });

  it('request_access posts the email and the page language as JSON and returns the answer as text', async () => {
    const recording = fetchRecording({ status: 200, payload: { status: 'requested' } });
    const [requestAccess] = tools({ fetchImplementation: recording.fetchImplementation });
    const result = await requestAccess!.execute({ email: 'maria@example.com' });
    expect(recording.calls[0]!.path).toBe('/api/request-access');
    expect(recording.calls[0]!.init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ email: 'maria@example.com', language: PAGE_LANGUAGE }),
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]!.text)).toEqual({ status: 'requested' });
  });

  it('flags an answer that is not ok as a tool error', async () => {
    const recording = fetchRecording({ status: 422, payload: { status: 'invalid_email' } });
    const [requestAccess] = tools({ fetchImplementation: recording.fetchImplementation });
    const result = await requestAccess!.execute({ email: 'nope', language: 'pt-BR' });
    expect(result.isError).toBe(true);
    expect(recording.calls[0]!.init!.body).toBe(JSON.stringify({ email: 'nope', language: 'pt-BR' }));
  });

  it('flags an answer that is not JSON, and a failed request, as tool errors with a status', async () => {
    const notJson = (async () => new Response('<html>bad gateway</html>', { status: 502 })) as unknown as typeof fetch;
    const unreachable = (async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const [first] = tools({ fetchImplementation: notJson });
    const [second] = tools({ fetchImplementation: unreachable });
    const htmlResult = await first!.execute({ email: 'maria@example.com' });
    const networkResult = await second!.execute({ email: 'maria@example.com' });
    expect(htmlResult.isError).toBe(true);
    expect(JSON.parse(htmlResult.content[0]!.text)).toEqual({ status: 'unreadable_response', httpStatus: 502 });
    expect(networkResult.isError).toBe(true);
    expect(JSON.parse(networkResult.content[0]!.text)).toEqual({ status: 'network_error' });
  });

  it('get_pricing and get_quick_start ask the endpoints with the language and the agent', async () => {
    const recording = fetchRecording({ status: 200, payload: {} });
    const registered = tools({ fetchImplementation: recording.fetchImplementation });
    await registered[1]!.execute({ language: 'pt-BR' });
    await registered[2]!.execute({ agent: 'some-agent' });
    expect(recording.calls.map((call) => call.path)).toEqual([
      '/api/pricing?language=pt-BR',
      '/api/quick-start?agent=some-agent&language=en',
    ]);
  });

  it('switch_language submits the matching language option of the footer menu', async () => {
    const submitted: string[] = [];
    const options: LanguageOption[] = ['en', 'pt-BR'].map((lang) => ({
      lang,
      form: { requestSubmit: (submitter) => submitted.push(submitter.lang) },
    }));
    const registered = tools({ page: pageOf({ options }) });
    const result = await registered[3]!.execute({ language: 'pt_br' });
    expect(submitted).toEqual(['pt-BR']);
    expect(JSON.parse(result.content[0]!.text)).toEqual({ status: 'switching', language: 'pt-BR' });
  });

  it('switch_language matches a regional tag to a language option and refuses an unknown one with the list', async () => {
    const submitted: string[] = [];
    const options: LanguageOption[] = ['en', 'pt-BR'].map((lang) => ({
      lang,
      form: { requestSubmit: (submitter) => submitted.push(submitter.lang) },
    }));
    const registered = tools({ page: pageOf({ options }) });
    await registered[3]!.execute({ language: 'en-US' });
    const refused = await registered[3]!.execute({ language: 'xx' });
    expect(submitted).toEqual(['en']);
    expect(refused.isError).toBe(true);
    expect(JSON.parse(refused.content[0]!.text)).toEqual({ status: 'unsupported_language', languages: ['en', 'pt-BR'] });
  });
});
