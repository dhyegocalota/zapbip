export function constantTimeEqual(input: { left: string; right: string }): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(input.left);
  const rightBytes = encoder.encode(input.right);
  const lengthDifference = leftBytes.length ^ rightBytes.length;
  const byteDifference = leftBytes.reduce((difference, byte, index) => difference | (byte ^ rightBytes[index]!), 0);
  return (lengthDifference | byteDifference) === 0;
}
