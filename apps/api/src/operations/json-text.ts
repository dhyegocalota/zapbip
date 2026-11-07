export function parseJsonOrNull(input: { text: string }): unknown {
  try {
    return JSON.parse(input.text);
  } catch {
    return null;
  }
}
