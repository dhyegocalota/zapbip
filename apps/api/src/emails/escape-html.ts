const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HTML_SPECIAL_CHARACTERS = /[&<>"']/g;

export function escapeHtml(input: { text: string }): string {
  return input.text.replace(HTML_SPECIAL_CHARACTERS, (character) => HTML_ESCAPES[character]!);
}
