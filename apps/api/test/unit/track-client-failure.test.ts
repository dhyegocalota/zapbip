import { describe, expect, it } from 'vitest';
import { trackClientFailure } from '../../src/routes/track-client-failure';

const DECLARED_BYTES = 12;
const PARTIAL_BYTES = new Uint8Array(DECLARED_BYTES - 1);

function stalledStream(): { body: ReadableStream<Uint8Array>; read: Promise<void> } {
  const signal = { markRead: () => {} };
  const read = new Promise<void>((resolve) => {
    signal.markRead = resolve;
  });
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        signal.markRead();
        return new Promise<void>(() => {});
      },
    },
    { highWaterMark: 0 },
  );
  return { body, read };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('trackClientFailure', () => {
  it('WI-146 a stream cancelled during a pending read is not a client failure', async () => {
    const stalled = stalledStream();
    const tracked = trackClientFailure({ body: stalled.body, sizeBytes: DECLARED_BYTES });
    const reader = tracked.stream.getReader();
    const pendingRead = reader.read();
    await stalled.read;
    await reader.cancel();
    await pendingRead;
    await settle();
    expect(tracked.clientFailure.occurred).toBe(false);
  });

  it('WI-146 pin: a body that ends short is a client failure', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(PARTIAL_BYTES);
        controller.close();
      },
    });
    const tracked = trackClientFailure({ body, sizeBytes: DECLARED_BYTES });
    await new Response(tracked.stream).arrayBuffer();
    expect(tracked.clientFailure.occurred).toBe(true);
  });

  it('WI-146 pin: a body that errors is a client failure', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('client aborted'));
      },
    });
    const tracked = trackClientFailure({ body, sizeBytes: DECLARED_BYTES });
    await new Response(tracked.stream).arrayBuffer().catch(() => undefined);
    expect(tracked.clientFailure.occurred).toBe(true);
  });
});
