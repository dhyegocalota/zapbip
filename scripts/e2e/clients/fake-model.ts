import { createServer, type IncomingMessage, type Server } from 'node:http';
import { containerReachableHost } from './container-host';
import { freePort } from './free-port';

const MODELS_PATH_SUFFIX = '/models';
const MODEL_ID = 'fake-model';
const REPLY_PREFIX = 'Recebi: ';
const TOKEN_PATTERN = /ping-[a-z0-9-]+/g;
const NO_TOKEN_TEXT = 'nothing';
const USER_ROLE = 'user';
const TOOL_ROLE = 'tool';
const TOOL_REQUEST_PATTERN = /ping-tool-[a-z0-9-]+/;
const CHECK_INBOX_TOOL_SUFFIX = 'check_inbox';
const TOOL_SEARCH_NAME = 'tool_search';
const TOOL_SEARCH_QUERY = 'inbox';
const STRING_TYPE = 'string';
const STRING_QUERIES_ARGUMENTS = JSON.stringify({ queries: [TOOL_SEARCH_QUERY] });
const SINGLE_QUERY_ARGUMENTS = JSON.stringify({ query: TOOL_SEARCH_QUERY });
const EMPTY_ARGUMENTS = '{}';
const TOOL_CALL_ID = 'call_fake_check_inbox';
const JSON_HEADERS = { 'content-type': 'application/json' };
const STREAM_HEADERS = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' };
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;

type ContentPart = { text: string } | { type: string };
type ChatMessage = { role: string; content: string | ContentPart[] };
type ToolParameters = { properties?: Record<string, { items?: { type?: string } }> };
type NestedToolDeclaration = { type: string; function: { name: string; parameters?: ToolParameters } };
type FlatToolDeclaration = { name: string; parameters?: ToolParameters };
type BuiltInToolDeclaration = { type: string };
type ToolDeclaration = NestedToolDeclaration | FlatToolDeclaration | BuiltInToolDeclaration;
type ChatBody = {
  tools: ToolDeclaration[] | undefined;
  model: string | undefined;
  stream: boolean | undefined;
  messages: ChatMessage[] | undefined;
  input: ChatMessage[] | string | undefined;
};

export type FakeModelRequest = { url: string; userText: string; toolResultTexts: string[]; toolNames: string[] };

export type FakeModel = {
  port: number;
  requests: FakeModelRequest[];
  requestsMentioning: (input: { text: string }) => FakeModelRequest[];
  close: () => Promise<void>;
};

export function replyTo(input: { token: string }): string {
  return `${REPLY_PREFIX}${input.token}`;
}

function tokenOf(input: { text: string }): string {
  const lastMatch = [...input.text.matchAll(TOKEN_PATTERN)].at(-1);
  if (!lastMatch) return NO_TOKEN_TEXT;
  return lastMatch[0];
}

function contentText(input: { content: ChatMessage['content'] }): string {
  if (typeof input.content === 'string') return input.content;
  return input.content.map((part) => ('text' in part ? part.text : '')).join(' ');
}

function conversationOf(input: { body: ChatBody }): ChatMessage[] {
  const { messages, input: responsesInput } = input.body;
  if (messages !== undefined) return messages;
  if (typeof responsesInput === 'string') return [{ role: USER_ROLE, content: responsesInput }];
  if (responsesInput !== undefined) return responsesInput;
  return [];
}

function userTextOf(input: { body: ChatBody }): string {
  return conversationOf(input)
    .filter((message) => message.role === USER_ROLE)
    .map((message) => contentText({ content: message.content }))
    .join('\n');
}

function toolResultTextsOf(input: { body: ChatBody }): string[] {
  return conversationOf(input)
    .filter((message) => message.role === TOOL_ROLE)
    .map((message) => contentText({ content: message.content }));
}

function declaredNameOf(input: { tool: ToolDeclaration }): string | undefined {
  const { tool } = input;
  if ('function' in tool) return tool.function.name;
  if ('name' in tool) return tool.name;
  return undefined;
}

function parametersOf(input: { tool: ToolDeclaration }): ToolParameters | undefined {
  const { tool } = input;
  if ('function' in tool) return tool.function.parameters;
  if ('name' in tool) return tool.parameters;
  throw new Error(`unknown tool declaration shape: ${JSON.stringify(tool)}`);
}

function searchArgumentsOf(input: { searchTool: ToolDeclaration }): string {
  const parameters = parametersOf({ tool: input.searchTool });
  if (parameters?.properties?.queries?.items?.type === STRING_TYPE) return STRING_QUERIES_ARGUMENTS;
  return SINGLE_QUERY_ARGUMENTS;
}

function toolNamesOf(input: { body: ChatBody }): string[] {
  const { tools } = input.body;
  if (tools === undefined) return [];
  return tools.map((tool) => declaredNameOf({ tool })).filter((name): name is string => name !== undefined);
}

type ToolCallPlan = { toolName: string; toolArguments: string };

function toolCallPlanOf(input: { body: ChatBody }): ToolCallPlan | null {
  const { tools } = input.body;
  if (tools === undefined) return null;
  const names = toolNamesOf(input);
  const checkInboxName = names.find((name) => name.endsWith(CHECK_INBOX_TOOL_SUFFIX));
  if (checkInboxName !== undefined) return { toolName: checkInboxName, toolArguments: EMPTY_ARGUMENTS };
  const searchTool = tools.find((tool) => declaredNameOf({ tool }) === TOOL_SEARCH_NAME);
  if (searchTool === undefined) return null;
  return { toolName: TOOL_SEARCH_NAME, toolArguments: searchArgumentsOf({ searchTool }) };
}

function modelOf(input: { body: ChatBody }): string {
  if (input.body.model === undefined) return MODEL_ID;
  return input.body.model;
}

async function readBody(input: { request: IncomingMessage }): Promise<ChatBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of input.request) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length === 0) return { model: undefined, stream: undefined, messages: undefined, input: undefined, tools: undefined };
  return JSON.parse(raw) as ChatBody;
}

function streamedCompletion(input: { content: string; model: string }): string {
  const base = { id: 'chatcmpl-fake', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: input.model };
  const first = { ...base, choices: [{ index: 0, delta: { role: 'assistant', content: input.content }, finish_reason: null }] };
  const last = {
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  return `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`;
}

function completion(input: { content: string; model: string }): string {
  return JSON.stringify({
    id: 'chatcmpl-fake',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: input.model,
    choices: [{ index: 0, message: { role: 'assistant', content: input.content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

function streamedToolCall(input: { plan: ToolCallPlan; model: string }): string {
  const base = { id: 'chatcmpl-fake', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: input.model };
  const toolCall = {
    index: 0,
    id: TOOL_CALL_ID,
    type: 'function',
    function: { name: input.plan.toolName, arguments: input.plan.toolArguments },
  };
  const first = { ...base, choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [toolCall] }, finish_reason: null }] };
  const last = {
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  return `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`;
}

function toolCallCompletion(input: { plan: ToolCallPlan; model: string }): string {
  const toolCall = { id: TOOL_CALL_ID, type: 'function', function: { name: input.plan.toolName, arguments: input.plan.toolArguments } };
  return JSON.stringify({
    id: 'chatcmpl-fake',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: input.model,
    choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [toolCall] }, finish_reason: 'tool_calls' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

function closeServer(input: { server: Server }): Promise<void> {
  return new Promise((resolve) => {
    input.server.close(() => resolve());
    input.server.closeAllConnections();
  });
}

export async function startFakeModel(): Promise<FakeModel> {
  const port = await freePort();
  const requests: FakeModelRequest[] = [];
  const server = createServer(async (request, response) => {
    const { url } = request;
    if (url === undefined) {
      response.writeHead(HTTP_BAD_REQUEST).end();
      return;
    }
    if (url.endsWith(MODELS_PATH_SUFFIX)) {
      response.writeHead(HTTP_OK, JSON_HEADERS).end(JSON.stringify({ object: 'list', data: [{ id: MODEL_ID, object: 'model' }] }));
      return;
    }
    const body = await readBody({ request });
    const userText = userTextOf({ body });
    const toolResultTexts = toolResultTextsOf({ body });
    requests.push({ url, userText, toolResultTexts, toolNames: toolNamesOf({ body }) });
    const content = replyTo({ token: tokenOf({ text: userText }) });
    const model = modelOf({ body });
    const plan = toolCallPlanOf({ body });
    const mustCallTool = plan !== null && TOOL_REQUEST_PATTERN.test(userText) && toolResultTexts.length === 0;
    if (mustCallTool && body.stream) {
      response.writeHead(HTTP_OK, STREAM_HEADERS).end(streamedToolCall({ plan, model }));
      return;
    }
    if (mustCallTool) {
      response.writeHead(HTTP_OK, JSON_HEADERS).end(toolCallCompletion({ plan, model }));
      return;
    }
    if (body.stream) {
      response.writeHead(HTTP_OK, STREAM_HEADERS).end(streamedCompletion({ content, model }));
      return;
    }
    response.writeHead(HTTP_OK, JSON_HEADERS).end(completion({ content, model }));
  });
  const bindHost = await containerReachableHost();
  await new Promise<void>((resolve) => server.listen(port, bindHost, resolve));
  return {
    port,
    requests,
    requestsMentioning: ({ text }) => requests.filter((entry) => entry.userText.includes(text)),
    close: () => closeServer({ server }),
  };
}
