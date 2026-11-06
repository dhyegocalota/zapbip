export type TrackedBody = { stream: ReadableStream<Uint8Array>; clientFailure: { occurred: boolean } };

export function trackClientFailure(input: { body: ReadableStream<Uint8Array>; sizeBytes: number }): TrackedBody {
  const reader = input.body.getReader();
  const clientFailure = { occurred: false };
  const received = { bytes: 0 };
  const cancellation = { requested: false };
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (cancellation.requested) return;
        received.bytes += chunk.done ? 0 : chunk.value.byteLength;
        clientFailure.occurred = chunk.done && received.bytes < input.sizeBytes;
        if (chunk.done) return controller.close();
        controller.enqueue(chunk.value);
      } catch (error) {
        if (cancellation.requested) return;
        clientFailure.occurred = true;
        controller.error(error);
      }
    },
    cancel(reason) {
      cancellation.requested = true;
      return reader.cancel(reason);
    },
  });
  return { stream, clientFailure };
}
