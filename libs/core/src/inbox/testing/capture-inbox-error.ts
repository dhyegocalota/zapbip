import { InboxError } from '../errors';
import type { InboxErrorCode, ChannelErrorKind } from '@zapbip/types';

export type CapturedInboxError = { code: InboxErrorCode | ChannelErrorKind; message: string };

export async function captureInboxError(run: () => unknown): Promise<CapturedInboxError> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof InboxError)) throw error;
    return { code: error.code, message: error.message };
  }
  throw new Error('expected an InboxError, nothing was thrown');
}
