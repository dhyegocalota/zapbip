import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { InboxError } from '@zapbip/core';
import type { CallOutcome } from '../contract/account-inbox-rpc';
import { TEXT_CONTENT_TYPE } from './constants';
import type { ToolSuccess } from './types';

export function toolErrorResult(input: { message: string }): CallToolResult {
  return { isError: true, content: [{ type: TEXT_CONTENT_TYPE, text: input.message }] };
}

export function toolSuccessResult(input: ToolSuccess): CallToolResult {
  return {
    content: [{ type: TEXT_CONTENT_TYPE, text: JSON.stringify(input.structured) }, ...input.images],
    structuredContent: input.structured,
  };
}

export function unwrapOutcome<Value>(input: { outcome: CallOutcome<Value> }): Value {
  if (input.outcome.ok) return input.outcome.value;
  throw new InboxError({ code: input.outcome.errorCode, message: input.outcome.message });
}
