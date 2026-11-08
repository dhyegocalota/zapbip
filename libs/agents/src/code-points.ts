export function compareCodePoints(input: { left: string; right: string }): number {
  if (input.left < input.right) return -1;
  if (input.left > input.right) return 1;
  return 0;
}
