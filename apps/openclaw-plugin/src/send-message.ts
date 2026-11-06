import {
  JSON_CONTENT_TYPE,
  JSON_RPC_VERSION,
  MCP_ACCEPT_HEADER,
  MCP_CLIENT_NAME,
  MCP_CLIENT_VERSION,
  MCP_PROTOCOL_VERSION,
  SEND_MESSAGE_TOOL_NAME,
} from './constants';

type ToolCallResult = { isError?: boolean; content?: Array<{ text?: string }>; structuredContent: { message_id: string } };
type RpcResponse = { result: ToolCallResult };

const INITIALIZE_REQUEST_ID = 1;
const TOOL_CALL_REQUEST_ID = 2;
const REQUEST_FAILED_MESSAGE = 'the send_message request failed';

async function postRpc(input: { mcpLink: string; id: number | null; method: string; params: object }): Promise<Response> {
  const { mcpLink, id, method, params } = input;
  const body = JSON.stringify({ jsonrpc: JSON_RPC_VERSION, ...(id === null ? {} : { id }), method, params });
  const response = await fetch(mcpLink, {
    method: 'POST',
    headers: { 'content-type': JSON_CONTENT_TYPE, accept: MCP_ACCEPT_HEADER },
    body,
    redirect: 'error',
  }).catch(() => {
    throw new Error(REQUEST_FAILED_MESSAGE);
  });
  if (!response.ok) throw new Error(`${REQUEST_FAILED_MESSAGE} with status ${response.status}`);
  return response;
}

export async function sendOwnerText(input: { mcpLink: string; text: string }): Promise<string | null> {
  const { mcpLink, text } = input;
  if (text === '') return null;
  await postRpc({
    mcpLink,
    id: INITIALIZE_REQUEST_ID,
    method: 'initialize',
    params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: MCP_CLIENT_NAME, version: MCP_CLIENT_VERSION } },
  });
  await postRpc({ mcpLink, id: null, method: 'notifications/initialized', params: {} });
  const response = await postRpc({
    mcpLink,
    id: TOOL_CALL_REQUEST_ID,
    method: 'tools/call',
    params: { name: SEND_MESSAGE_TOOL_NAME, arguments: { text } },
  });
  const { result } = (await response.json()) as RpcResponse;
  if (result.isError) throw new Error(result.content?.map((part) => part.text).join(' '));
  return result.structuredContent.message_id;
}
