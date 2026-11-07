import { describe, expect, it } from 'vitest';
import { isJsonRpcBatch, isJsonRpcSuccess } from '../../src/mcp/json-rpc-outcome';

function postRequest(input: { body: string }): Request {
  return new Request('http://localhost/mcp', { method: 'POST', body: input.body });
}

describe('json-rpc outcome', () => {
  it('recognises a batch only on POST', async () => {
    expect(await isJsonRpcBatch({ request: postRequest({ body: '[{"jsonrpc":"2.0","id":1,"method":"ping"}]' }) })).toBe(true);
    expect(await isJsonRpcBatch({ request: postRequest({ body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' }) })).toBe(false);
    expect(await isJsonRpcBatch({ request: new Request('http://localhost/mcp') })).toBe(false);
  });

  it.each([
    { title: 'a result', body: '{"jsonrpc":"2.0","id":1,"result":{}}', expected: true },
    { title: 'a result in a stream', body: '{"jsonrpc":"2.0","id":1,"result":{}}', contentType: 'text/event-stream', expected: false },
    { title: 'an error', body: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"x"}}', expected: false },
    { title: 'no body', body: '', expected: false },
  ])('treats $title as success=$expected', async ({ body, contentType = 'application/json', expected }) => {
    const response = new Response(body, { headers: { 'content-type': contentType } });
    expect(await isJsonRpcSuccess({ response })).toBe(expected);
  });
});
