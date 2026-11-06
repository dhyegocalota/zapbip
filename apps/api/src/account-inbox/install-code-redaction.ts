export function redactInstallCodes(input: { storage: DurableObjectStorage }): void {
  throw new Error(`redactInstallCodes is not implemented for ${typeof input.storage}`);
}
